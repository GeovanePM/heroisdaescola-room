import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const classroomRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('room_classrooms')
      .select('*')
      .eq('school_id', ctx.staff.schoolId)
      .eq('active', true)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }),

  myRooms: protectedProcedure.query(async ({ ctx }) => {
    console.log('[myRooms] staff.id:', ctx.staff.id, 'role:', ctx.staff.role)

    const { data: links, error: linkErr } = await supabase
      .from('room_classroom_staff')
      .select('classroom_id')
      .eq('staff_id', ctx.staff.id)

    console.log('[myRooms] links:', links, 'err:', linkErr)

    if (!links?.length) return []

    const ids = links.map((l: any) => l.classroom_id)
    const { data, error } = await supabase
      .from('room_classrooms')
      .select('*')
      .in('id', ids)
      .eq('active', true)
      .order('name')

    if (error) throw new Error(error.message)
    return data ?? []
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('room_classrooms')
        .select('*')
        .eq('id', input.id)
        .eq('school_id', ctx.staff.schoolId)
        .maybeSingle()

      if (error || !data) throw new Error('Sala não encontrada')
      return data
    }),

  create: protectedProcedure
    .input(z.object({
      name:    z.string().min(1),
      segment: z.enum(['fund1', 'fund2', 'medio']),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director', 'vice_director'].includes(ctx.staff.role))
        throw new Error('Sem permissão')

      const { data, error } = await supabase
        .from('room_classrooms')
        .insert({ name: input.name, segment: input.segment, school_id: ctx.staff.schoolId })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    }),
})
