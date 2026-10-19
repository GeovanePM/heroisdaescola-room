import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function getWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function cardTypeForPosition(pos: number): string {
  if (pos === 1) return 'legendary'
  if (pos <= 3) return 'gold'
  if (pos <= 6) return 'silver'
  return 'bronze'
}

export const cardsRouter = router({

  myCards: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_classroom_cards')
        .select('*')
        .eq('classroom_id', input.classroomId)
        .order('earned_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data ?? []
    }),

  schoolCards: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('room_classroom_cards')
      .select('*, room_classrooms(name, hero_name)')
      .eq('school_id', ctx.staff.schoolId)
      .order('earned_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)
    return data ?? []
  }),

  // Distribui cartas para a semana atual (idempotente)
  distributeWeekly: protectedProcedure.mutation(async ({ ctx }) => {
    if (!['admin', 'director'].includes(ctx.staff.role))
      throw new Error('Sem permissão')

    const week = getWeekNumber()
    const year = new Date().getFullYear()

    // Verifica se já distribuiu esta semana
    const { data: existing } = await supabase
      .from('room_classroom_cards')
      .select('id')
      .eq('school_id', ctx.staff.schoolId)
      .eq('week_number', week)
      .eq('year', year)
      .limit(1)

    if (existing && existing.length > 0)
      return { ok: false, message: 'Cartas desta semana já distribuídas.' }

    const { data: classrooms } = await supabase
      .from('room_classrooms')
      .select('id')
      .eq('school_id', ctx.staff.schoolId)
      .eq('active', true)
      .order('xp', { ascending: false })

    if (!classrooms?.length) return { ok: false, message: 'Nenhuma sala.' }

    const records = classrooms.map((c: any, i: number) => ({
      classroom_id: c.id,
      school_id:    ctx.staff.schoolId,
      card_type:    cardTypeForPosition(i + 1),
      week_number:  week,
      year,
    }))

    const { error } = await supabase.from('room_classroom_cards').insert(records)
    if (error) throw new Error(error.message)

    return { ok: true, distributed: records.length }
  }),
})
