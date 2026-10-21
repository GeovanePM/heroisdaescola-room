import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'
import { broadcastToRoom } from '../index.js'
import { sendTelegram } from '../telegram.js'
import { currentPeriodLocal } from './schedule.js'

const XP_TABLE: Record<string, number> = {
  saida_sala:            0,
  retorno_sala:          0,
  disciplina:           -5,
  participacao:         10,
  pontualidade:          5,
  intervencao:           0,
  intervencao_encerrada: 0,
}

async function notifySupervisors(schoolId: string, message: string) {
  const { data } = await supabase
    .from('room_staff')
    .select('telegram_chat_id')
    .eq('school_id', schoolId)
    .in('role', ['supervisor', 'vice_director', 'director'])
    .eq('active', true)
    .not('telegram_chat_id', 'is', null)

  for (const s of data ?? []) {
    if (s.telegram_chat_id) await sendTelegram(s.telegram_chat_id, message)
  }
}

export const eventRouter = router({
  register: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      type:        z.enum(['saida_sala', 'retorno_sala', 'disciplina', 'participacao', 'pontualidade', 'intervencao', 'intervencao_encerrada']),
      studentRef:  z.string().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let xpValue = XP_TABLE[input.type]

      // Pontualidade automática: se professor chegou dentro de um período de aula, bônus extra
      if (input.type === 'pontualidade') {
        const { data: periods } = await supabase
          .from('room_periods')
          .select('*')
          .eq('school_id', ctx.staff.schoolId)
        const period = currentPeriodLocal(periods ?? [])
        if (period && !period.is_break) xpValue = 10  // bônus em horário de aula confirmado
      }

      const { data: event, error: evErr } = await supabase
        .from('room_classroom_events')
        .insert({
          classroom_id: input.classroomId,
          staff_id:     ctx.staff.id,
          type:         input.type,
          student_ref:  input.studentRef,
          notes:        input.notes,
          xp_value:     xpValue,
        })
        .select()
        .single()

      if (evErr) throw new Error(evErr.message)

      if (xpValue !== 0) {
        const { data: room } = await supabase
          .from('room_classrooms')
          .select('xp')
          .eq('id', input.classroomId)
          .single()

        if (room) {
          await supabase
            .from('room_classrooms')
            .update({ xp: Math.max(0, room.xp + xpValue) })
            .eq('id', input.classroomId)

          await supabase
            .from('room_classroom_xp_log')
            .insert({ classroom_id: input.classroomId, xp_delta: xpValue, source_type: 'event' })
        }
      }

      broadcastToRoom(input.classroomId, { type: 'event', event })
      broadcastToRoom('supervisor', { type: 'event', event })

      // Alerta Telegram: aluno saiu → avisa supervisor após 5min se não retornou
      if (input.type === 'saida_sala' && input.studentRef) {
        const classroomId  = input.classroomId
        const studentRef   = input.studentRef
        const exitReason   = input.notes ?? null
        const eventId      = event.id
        const schoolId     = ctx.staff.schoolId

        setTimeout(async () => {
          const { data: returnEvent } = await supabase
            .from('room_classroom_events')
            .select('id')
            .eq('classroom_id', classroomId)
            .eq('type', 'retorno_sala')
            .eq('student_ref', studentRef)
            .gt('created_at', new Date(event.created_at).toISOString())
            .limit(1)

          if (!returnEvent?.length) {
            const { data: room } = await supabase
              .from('room_classrooms')
              .select('name, shift')
              .eq('id', classroomId)
              .single()

            const reasonLine = exitReason ? `\n📋 Motivo: ${exitReason}` : ''
            const msg = `⚠️ <b>Aluno fora da sala há 5 min</b>\n👤 <b>${studentRef}</b>${reasonLine}\n🏫 Sala: ${room?.name ?? classroomId}\nVerifique a situação.`
            await notifySupervisors(schoolId, msg)
          }
        }, 5 * 60 * 1000)
      }

      // Intervenção: alerta imediato para supervisores e diretores
      if (input.type === 'intervencao') {
        const { data: room } = await supabase
          .from('room_classrooms').select('name, shift').eq('id', input.classroomId).single()
        const SHIFT: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
        const shift = room?.shift ? (SHIFT[room.shift] ?? room.shift) : ''
        const msg = `🚨 <b>INTERVENÇÃO SOLICITADA</b>\n🏫 Sala: <b>${room?.name ?? input.classroomId}</b> (${shift})\n👨‍🏫 Professor solicitou presença imediata.`
        await notifySupervisors(ctx.staff.schoolId, msg)
      }

      return event
    }),

  list: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_classroom_events')
        .select('*')
        .eq('classroom_id', input.classroomId)
        .order('created_at', { ascending: false })
        .limit(input.limit)

      if (error) throw new Error(error.message)
      return data ?? []
    }),
})
