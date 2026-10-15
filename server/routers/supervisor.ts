import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const supervisorRouter = router({
  allClassrooms: protectedProcedure.query(async ({ ctx }) => {
    if (!['supervisor', 'vice_director', 'director', 'admin'].includes(ctx.staff.role))
      throw new TRPCError({ code: 'FORBIDDEN' })

    const { data, error } = await supabase
      .from('room_classrooms')
      .select('*')
      .eq('school_id', ctx.staff.schoolId)
      .eq('active', true)
      .order('xp', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }),

  recentEvents: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      if (!['supervisor', 'vice_director', 'director', 'admin'].includes(ctx.staff.role))
        throw new TRPCError({ code: 'FORBIDDEN' })

      const { data: classrooms } = await supabase
        .from('room_classrooms')
        .select('id')
        .eq('school_id', ctx.staff.schoolId)

      if (!classrooms?.length) return []

      const ids = classrooms.map((c: any) => c.id)
      const { data, error } = await supabase
        .from('room_classroom_events')
        .select('*, room_classrooms(name), room_staff(name)')
        .in('classroom_id', ids)
        .order('created_at', { ascending: false })
        .limit(input.limit)

      if (error) throw new Error(error.message)
      return data ?? []
    }),

  validate: protectedProcedure
    .input(z.object({
      eventId:   z.string().uuid(),
      validated: z.boolean(),
      notes:     z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['supervisor', 'vice_director', 'director', 'admin'].includes(ctx.staff.role))
        throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await supabase
        .from('room_supervisor_validations')
        .insert({
          event_id:      input.eventId,
          supervisor_id: ctx.staff.id,
          validated:     input.validated,
          notes:         input.notes,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    }),

  weeklyRanking: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('room_classrooms')
      .select('id, name, segment, xp, level, hero_name, hero_image_url')
      .eq('school_id', ctx.staff.schoolId)
      .eq('active', true)
      .order('xp', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }),
})
