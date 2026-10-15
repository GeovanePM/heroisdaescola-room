import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const diaryRouter = router({
  save: protectedProcedure
    .input(z.object({
      classroomId:      z.string().uuid(),
      subject:          z.string().min(1),
      date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      contentPlanned:   z.string().optional(),
      contentDelivered: z.string().min(1),
      notes:            z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('room_content_diary')
        .insert({
          classroom_id:      input.classroomId,
          staff_id:          ctx.staff.id,
          subject:           input.subject,
          date:              input.date,
          content_planned:   input.contentPlanned,
          content_delivered: input.contentDelivered,
          notes:             input.notes,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    }),

  list: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_content_diary')
        .select('*')
        .eq('classroom_id', input.classroomId)
        .order('date', { ascending: false })
        .limit(30)

      if (error) throw new Error(error.message)
      return data ?? []
    }),
})
