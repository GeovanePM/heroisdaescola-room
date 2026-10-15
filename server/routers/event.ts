import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'
import { broadcastToRoom } from '../index.js'

const XP_TABLE: Record<string, number> = {
  saida_sala:   0,
  retorno_sala: 0,
  disciplina:  -5,
  participacao: 10,
  pontualidade: 5,
}

export const eventRouter = router({
  register: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      type:        z.enum(['saida_sala', 'retorno_sala', 'disciplina', 'participacao', 'pontualidade']),
      studentRef:  z.string().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const xpValue = XP_TABLE[input.type]

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
