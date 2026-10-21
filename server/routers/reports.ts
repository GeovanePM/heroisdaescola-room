import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function requireDirector(role: string) {
  if (!['director', 'admin', 'vice_director'].includes(role))
    throw new TRPCError({ code: 'FORBIDDEN' })
}

function sinceDate(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export const reportsRouter = router({

  // Resumo geral: totais + breakdown por turma
  summary: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      requireDirector(ctx.staff.role)
      const since = sinceDate(input.days)
      const schoolId = ctx.staff.schoolId!

      const { data: classrooms } = await supabase
        .from('room_classrooms').select('id, name, xp, level, shift, segment')
        .eq('school_id', schoolId).eq('active', true).order('name')

      const ids = (classrooms ?? []).map((c: any) => c.id)
      if (!ids.length) return { classrooms: [], totals: { events: 0, exits: 0, interventions: 0, xpGained: 0, checkins: 0 } }

      const [eventsRes, checkinsRes] = await Promise.all([
        supabase.from('room_classroom_events').select('classroom_id, type, xp_value')
          .in('classroom_id', ids).gte('created_at', since),
        supabase.from('room_teacher_checkins').select('classroom_id, checked_in_at, checked_out_at')
          .in('classroom_id', ids).gte('checked_in_at', since),
      ])

      const evs      = eventsRes.data   ?? []
      const checkins = checkinsRes.data ?? []

      const totals = {
        events:        evs.length,
        exits:         evs.filter((e: any) => e.type === 'saida_sala').length,
        interventions: evs.filter((e: any) => e.type === 'intervencao').length,
        xpGained:      evs.reduce((acc: number, e: any) => acc + Math.max(0, e.xp_value), 0),
        checkins:      checkins.length,
      }

      const byRoom = (classrooms ?? []).map((room: any) => {
        const re = evs.filter((e: any) => e.classroom_id === room.id)
        const rc = checkins.filter((c: any) => c.classroom_id === room.id)
        const durations = rc
          .filter((c: any) => c.checked_out_at)
          .map((c: any) => (new Date(c.checked_out_at).getTime() - new Date(c.checked_in_at).getTime()) / 60000)
        const avgMin = durations.length ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : null

        return {
          id: room.id, name: room.name, xp: room.xp, level: room.level,
          shift: room.shift, segment: room.segment,
          eventCount:    re.length,
          exitCount:     re.filter((e: any) => e.type === 'saida_sala').length,
          interventions: re.filter((e: any) => e.type === 'intervencao').length,
          xpGained:      re.reduce((acc: number, e: any) => acc + Math.max(0, e.xp_value), 0),
          checkinCount:  rc.length,
          avgDurationMin: avgMin,
        }
      })

      return { classrooms: byRoom, totals }
    }),

  // Alunos que mais saem da sala
  topExits: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      requireDirector(ctx.staff.role)
      const since = sinceDate(input.days)
      const schoolId = ctx.staff.schoolId!

      const { data: classrooms } = await supabase
        .from('room_classrooms').select('id, name').eq('school_id', schoolId)
      const ids = (classrooms ?? []).map((c: any) => c.id)
      if (!ids.length) return []

      const roomMap: Record<string, string> = {}
      ;(classrooms ?? []).forEach((c: any) => { roomMap[c.id] = c.name })

      const { data: exits } = await supabase
        .from('room_classroom_events')
        .select('classroom_id, student_ref, notes, created_at')
        .in('classroom_id', ids).eq('type', 'saida_sala')
        .gte('created_at', since)
        .not('student_ref', 'is', null)

      const map: Record<string, any> = {}
      for (const ex of exits ?? []) {
        const key = `${ex.classroom_id}::${ex.student_ref}`
        if (!map[key]) map[key] = {
          studentRef: ex.student_ref, classroomId: ex.classroom_id,
          classroomName: roomMap[ex.classroom_id] ?? '?',
          count: 0, reasons: {} as Record<string, number>,
        }
        map[key].count++
        if (ex.notes) map[key].reasons[ex.notes] = (map[key].reasons[ex.notes] ?? 0) + 1
      }

      return Object.values(map).sort((a: any, b: any) => b.count - a.count).slice(0, 20)
    }),

  // Histórico de check-ins dos professores
  checkinHistory: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      requireDirector(ctx.staff.role)
      const since = sinceDate(input.days)
      const schoolId = ctx.staff.schoolId!

      const { data } = await supabase
        .from('room_teacher_checkins')
        .select('*, room_staff(name, role), room_classrooms(name, shift)')
        .eq('school_id', schoolId)
        .gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false })
        .limit(200)

      return (data ?? []).map((c: any) => {
        const durationMin = c.checked_out_at
          ? Math.round((new Date(c.checked_out_at).getTime() - new Date(c.checked_in_at).getTime()) / 60000)
          : null
        return { ...c, durationMin }
      })
    }),

  // Evolução de XP por turma (dia a dia)
  xpEvolution: protectedProcedure
    .input(z.object({ days: z.number().default(14) }))
    .query(async ({ ctx, input }) => {
      requireDirector(ctx.staff.role)
      const since = sinceDate(input.days)
      const schoolId = ctx.staff.schoolId!

      const { data: classrooms } = await supabase
        .from('room_classrooms').select('id, name, xp').eq('school_id', schoolId).order('xp', { ascending: false })
      const ids = (classrooms ?? []).map((c: any) => c.id)
      if (!ids.length) return []

      const { data: logs } = await supabase
        .from('room_classroom_xp_log').select('classroom_id, xp_delta, created_at')
        .in('classroom_id', ids).gte('created_at', since).gt('xp_delta', 0)
        .order('created_at')

      const roomMap: Record<string, string> = {}
      ;(classrooms ?? []).forEach((c: any) => { roomMap[c.id] = c.name })

      const byRoom: Record<string, { name: string; xpTotal: number; days: Record<string, number> }> = {}
      for (const log of logs ?? []) {
        const day = log.created_at.slice(0, 10)
        if (!byRoom[log.classroom_id]) byRoom[log.classroom_id] = {
          name: roomMap[log.classroom_id] ?? '?',
          xpTotal: (classrooms ?? []).find((c: any) => c.id === log.classroom_id)?.xp ?? 0,
          days: {},
        }
        byRoom[log.classroom_id].days[day] = (byRoom[log.classroom_id].days[day] ?? 0) + log.xp_delta
      }

      return Object.entries(byRoom).map(([id, v]) => ({
        classroomId: id, name: v.name, xpTotal: v.xpTotal, dailyXp: v.days,
      }))
    }),

  // Intervenções por turma
  interventions: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      requireDirector(ctx.staff.role)
      const since = sinceDate(input.days)
      const schoolId = ctx.staff.schoolId!

      const { data: classrooms } = await supabase
        .from('room_classrooms').select('id, name').eq('school_id', schoolId)
      const ids = (classrooms ?? []).map((c: any) => c.id)
      if (!ids.length) return []

      const roomMap: Record<string, string> = {}
      ;(classrooms ?? []).forEach((c: any) => { roomMap[c.id] = c.name })

      const { data: events } = await supabase
        .from('room_classroom_events')
        .select('classroom_id, type, created_at, room_staff(name)')
        .in('classroom_id', ids)
        .in('type', ['intervencao', 'intervencao_encerrada'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })

      const byRoom: Record<string, any> = {}
      for (const ev of events ?? []) {
        if (!byRoom[ev.classroom_id]) byRoom[ev.classroom_id] = {
          classroomName: roomMap[ev.classroom_id] ?? '?',
          count: 0, records: [],
        }
        if (ev.type === 'intervencao') {
          byRoom[ev.classroom_id].count++
          byRoom[ev.classroom_id].records.push({
            at: ev.created_at,
            teacher: (ev as any).room_staff?.name ?? '?',
          })
        }
      }

      return Object.values(byRoom).sort((a: any, b: any) => b.count - a.count)
    }),
})
