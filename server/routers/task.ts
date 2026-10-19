import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'
import { sendTelegram } from '../telegram.js'

// ── Helpers exportados para uso nos endpoints REST ────────────────────────────

export async function getTaskPublic(taskId: string) {
  const { data, error } = await supabase
    .from('room_tasks')
    .select('id, title, type, focus, target_count, xp_reward, deadline, status, room_classrooms(name, shift)')
    .eq('id', taskId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function handleCompletion(taskId: string, studentName: string) {
  const { data: task } = await supabase
    .from('room_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('status', 'active')
    .maybeSingle()

  if (!task) throw new Error('Tarefa não encontrada ou encerrada')

  await supabase
    .from('room_task_completions')
    .insert({ task_id: taskId, student_name: studentName.trim() })

  const { count } = await supabase
    .from('room_task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('task_id', taskId)

  const newCount = count ?? 1

  if (newCount >= task.target_count) {
    await closeTask(task, newCount, 'completed')
  }

  return { ok: true, current: newCount, target: task.target_count }
}

export async function checkAndExpireTasks(schoolId: string) {
  const { data: overdue } = await supabase
    .from('room_tasks')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .lt('deadline', new Date().toISOString())
    .not('deadline', 'is', null)

  for (const task of overdue ?? []) {
    const { count } = await supabase
      .from('room_task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id)
    await closeTask(task, count ?? 0, 'expired')
  }
}

const SHIFT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

async function closeTask(task: any, completionCount: number, status: 'completed' | 'expired') {
  const ratio     = Math.min(completionCount / task.target_count, 1)
  const xpAmount  = Math.round(ratio * task.xp_reward)

  const { data: classroom } = await supabase
    .from('room_classrooms').select('xp, name, shift').eq('id', task.classroom_id).single()

  if (xpAmount > 0 && classroom) {
    await supabase.from('room_classrooms')
      .update({ xp: classroom.xp + xpAmount }).eq('id', task.classroom_id)
    await supabase.from('room_classroom_xp_log')
      .insert({ classroom_id: task.classroom_id, xp_delta: xpAmount, source_type: 'task' })
  }

  await supabase.from('room_tasks')
    .update({ status, xp_awarded: xpAmount }).eq('id', task.id)

  const emoji     = status === 'completed' ? '✅' : '⚠️'
  const label     = status === 'completed' ? 'concluída' : 'expirada'
  const shiftStr  = classroom ? (SHIFT_LABEL[classroom.shift] ?? classroom.shift) : ''
  const roomLine  = classroom ? `\n🏫 Turma: ${classroom.name} (${shiftStr})` : ''
  const msg       = `${emoji} <b>Tarefa "${task.title}"</b> ${label}!${roomLine}\n📊 ${completionCount}/${task.target_count} alunos\n⚡ +${xpAmount} XP para a turma`

  const { data: managers } = await supabase
    .from('room_staff')
    .select('telegram_chat_id')
    .eq('school_id', task.school_id)
    .in('role', ['director', 'vice_director', 'supervisor'])
    .eq('active', true)
    .not('telegram_chat_id', 'is', null)

  const { data: creator } = await supabase
    .from('room_staff').select('telegram_chat_id').eq('id', task.staff_id).maybeSingle()

  const chatIds = new Set<string>([
    ...(managers ?? []).map((s: any) => s.telegram_chat_id),
    creator?.telegram_chat_id,
  ].filter(Boolean) as string[])

  for (const chatId of chatIds) await sendTelegram(chatId, msg)
}

// ── Router tRPC (uso interno pelo professor / diretor) ────────────────────────

export const taskRouter = router({

  create: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      title:       z.string().min(1).max(100),
      type:        z.enum(['tarefa', 'prova']),
      focus:       z.array(z.enum(['fracoes', 'problemas', 'logica'])).min(1),
      targetCount: z.number().int().min(1).max(500),
      xpReward:    z.number().int().min(0).max(1000),
      deadline:    z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('room_tasks')
        .insert({
          classroom_id: input.classroomId,
          school_id:    ctx.staff.schoolId,
          staff_id:     ctx.staff.id,
          title:        input.title,
          type:         input.type,
          focus:        input.focus,
          target_count: input.targetCount,
          xp_reward:    input.xpReward,
          deadline:     input.deadline ?? null,
        })
        .select().single()

      if (error) throw new Error(error.message)
      return data
    }),

  list: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      await checkAndExpireTasks(ctx.staff.schoolId)

      let query = supabase
        .from('room_tasks')
        .select('*, room_classrooms(name, shift), room_task_completions(id)')
        .eq('school_id', ctx.staff.schoolId)

      if (input.classroomId) {
        query = query.eq('classroom_id', input.classroomId)
      } else if (ctx.staff.role === 'teacher') {
        query = query.eq('staff_id', ctx.staff.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map((t: any) => ({
        ...t,
        completion_count: t.room_task_completions?.length ?? 0,
        room_task_completions: undefined,
      }))
    }),

  completions: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_task_completions')
        .select('student_name, completed_at')
        .eq('task_id', input.taskId)
        .order('completed_at')
      if (error) throw new Error(error.message)
      return data ?? []
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await supabase
        .from('room_tasks')
        .delete()
        .eq('id', input.id)
        .eq('school_id', ctx.staff.schoolId)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
