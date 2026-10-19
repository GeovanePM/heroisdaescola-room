import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function requireAdmin(role: string) {
  if (!['admin', 'director', 'vice_director'].includes(role))
    throw new Error('Sem permissão')
}

// Retorna o período atual com base no horário de Brasília
export function currentPeriodLocal(periods: any[]): any | null {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dow  = now.getDay()
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  return periods.find(p =>
    p.day_of_week === dow &&
    p.start_time <= hhmm &&
    p.end_time   >  hhmm
  ) ?? null
}

export const scheduleRouter = router({

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('room_periods')
      .select('*')
      .eq('school_id', ctx.staff.schoolId)
      .order('day_of_week')
      .order('start_time')

    if (error) throw new Error(error.message)
    return data ?? []
  }),

  currentPeriod: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await supabase
      .from('room_periods')
      .select('*')
      .eq('school_id', ctx.staff.schoolId)

    return currentPeriodLocal(data ?? [])
  }),

  create: protectedProcedure
    .input(z.object({
      dayOfWeek:    z.number().min(0).max(6),
      periodNumber: z.number().min(1),
      startTime:    z.string().regex(/^\d{2}:\d{2}$/),
      endTime:      z.string().regex(/^\d{2}:\d{2}$/),
      name:         z.string().optional(),
      isBreak:      z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { data, error } = await supabase
        .from('room_periods')
        .insert({
          school_id:     ctx.staff.schoolId,
          day_of_week:   input.dayOfWeek,
          period_number: input.periodNumber,
          start_time:    input.startTime,
          end_time:      input.endTime,
          name:          input.name,
          is_break:      input.isBreak,
        })
        .select().single()

      if (error) throw new Error(error.message)
      return data
    }),

  update: protectedProcedure
    .input(z.object({
      id:        z.string().uuid(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
      name:      z.string().optional(),
      isBreak:   z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { id, startTime, endTime, name, isBreak } = input
      const { data, error } = await supabase
        .from('room_periods')
        .update({ start_time: startTime, end_time: endTime, name, is_break: isBreak })
        .eq('id', id)
        .eq('school_id', ctx.staff.schoolId)
        .select().single()

      if (error) throw new Error(error.message)
      return data
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { error } = await supabase
        .from('room_periods')
        .delete()
        .eq('id', input.id)
        .eq('school_id', ctx.staff.schoolId)

      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
