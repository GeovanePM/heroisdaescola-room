import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'
import { broadcastToRoom } from '../index.js'

export const checkinRouter = router({
  // Professor entra na sala (via QR Code)
  enter: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // Valida que a sala pertence à escola do professor
      const { data: room } = await supabase
        .from('room_classrooms')
        .select('id, name, shift, hero_name, school_id')
        .eq('id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)
        .eq('active', true)
        .maybeSingle()

      if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sala não encontrada' })

      // Encerra check-in ativo anterior automaticamente
      await supabase
        .from('room_teacher_checkins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('staff_id', ctx.staff.id)
        .is('checked_out_at', null)

      // Registra novo check-in
      const { data: checkin, error } = await supabase
        .from('room_teacher_checkins')
        .insert({
          classroom_id:  input.classroomId,
          staff_id:      ctx.staff.id,
          school_id:     ctx.staff.schoolId,
          notes:         input.notes,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      const roomLabel = room.hero_name
        ? `${room.name} ${room.shift} · ${room.hero_name}`
        : `${room.name} ${room.shift}`

      broadcastToRoom('supervisor', {
        type:       'checkin',
        classroomId: input.classroomId,
        staffId:    ctx.staff.id,
        staffName:  ctx.staff.name,
        roomLabel,
        checkedInAt: checkin.checked_in_at,
      })

      return { checkin, room }
    }),

  // Professor sai da sala manualmente
  exit: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { data: active } = await supabase
        .from('room_teacher_checkins')
        .select('id, classroom_id')
        .eq('staff_id', ctx.staff.id)
        .is('checked_out_at', null)
        .maybeSingle()

      if (!active) return { ok: true }

      await supabase
        .from('room_teacher_checkins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', active.id)

      broadcastToRoom('supervisor', {
        type:        'checkout',
        classroomId: active.classroom_id,
        staffId:     ctx.staff.id,
        staffName:   ctx.staff.name,
      })

      return { ok: true }
    }),

  // Sala atual do professor logado
  myStatus: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await supabase
      .from('room_teacher_checkins')
      .select('*, room_classrooms(id, name, shift, hero_name, xp, level)')
      .eq('staff_id', ctx.staff.id)
      .is('checked_out_at', null)
      .maybeSingle()

    return data ?? null
  }),

  // Ocupação atual de toda a escola (supervisor/diretor)
  occupancy: protectedProcedure.query(async ({ ctx }) => {
    if (!['supervisor','vice_director','director','admin'].includes(ctx.staff.role))
      throw new TRPCError({ code: 'FORBIDDEN' })

    const { data, error } = await supabase
      .from('room_teacher_checkins')
      .select('*, room_classrooms(id, name, shift, hero_name), room_staff(id, name)')
      .eq('school_id', ctx.staff.schoolId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }),

  // Histórico de check-ins de uma sala
  history: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid(), limit: z.number().default(30) }))
    .query(async ({ input, ctx }) => {
      const { data } = await supabase
        .from('room_teacher_checkins')
        .select('*, room_staff(name)')
        .eq('classroom_id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)
        .order('checked_in_at', { ascending: false })
        .limit(input.limit)

      return data ?? []
    }),

  // Dados públicos da sala para a tela de check-in (antes de logar)
  roomInfo: publicProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data } = await supabase
        .from('room_classrooms')
        .select('id, name, shift, hero_name, hero_image_url, school_id, room_schools(name)')
        .eq('id', input.classroomId)
        .eq('active', true)
        .maybeSingle()

      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sala não encontrada' })
      return data
    }),
})
