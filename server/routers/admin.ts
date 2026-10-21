import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function requireAdmin(role: string) {
  if (!['admin', 'director', 'vice_director'].includes(role))
    throw new Error('Sem permissão')
}

export const adminRouter = router({

  // ── Salas ────────────────────────────────────────────────────────────────

  classroomList: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.staff.role)
    const { data, error } = await supabase
      .from('room_classrooms')
      .select('*')
      .eq('school_id', ctx.staff.schoolId)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }),

  classroomCreate: protectedProcedure
    .input(z.object({
      name:     z.string().min(1),
      segment:  z.enum(['fund1', 'fund2', 'medio']),
      shift:    z.enum(['manha', 'tarde', 'noite']),
      students: z.array(z.string().min(1).max(100)).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { students, ...classroomFields } = input
      const { data, error } = await supabase
        .from('room_classrooms')
        .insert({ ...classroomFields, school_id: ctx.staff.schoolId })
        .select().single()
      if (error) throw new Error(error.message)

      if (students && students.length > 0) {
        const rows = students.map((name, i) => ({
          classroom_id: data.id,
          school_id:    ctx.staff.schoolId,
          name:         name.trim(),
          call_number:  i + 1,
        }))
        const { error: sErr } = await supabase.from('room_students').insert(rows)
        if (sErr) throw new Error(sErr.message)
      }

      return { ...data, studentCount: students?.length ?? 0 }
    }),

  classroomUpdate: protectedProcedure
    .input(z.object({
      id:      z.string().uuid(),
      name:    z.string().min(1).optional(),
      segment: z.enum(['fund1', 'fund2', 'medio']).optional(),
      shift:   z.enum(['manha', 'tarde', 'noite']).optional(),
      active:  z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { id, ...fields } = input
      const { data, error } = await supabase
        .from('room_classrooms')
        .update(fields)
        .eq('id', id)
        .eq('school_id', ctx.staff.schoolId)
        .select().single()
      if (error) throw new Error(error.message)
      return data
    }),

  // ── Staff ─────────────────────────────────────────────────────────────────

  staffList: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.staff.role)
    const { data, error } = await supabase
      .from('room_staff')
      .select('id, name, email, role, active, telegram_chat_id')
      .eq('school_id', ctx.staff.schoolId)
      .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }),

  staffCreate: protectedProcedure
    .input(z.object({
      name:     z.string().min(1),
      email:    z.string().email(),
      password: z.string().min(6),
      role:     z.enum(['teacher', 'supervisor', 'vice_director', 'director']),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const hash = await bcrypt.hash(input.password, 10)
      const { data, error } = await supabase
        .from('room_staff')
        .insert({
          name:          input.name,
          email:         input.email,
          password_hash: hash,
          role:          input.role,
          school_id:     ctx.staff.schoolId,
        })
        .select('id, name, email, role, active')
        .single()
      if (error) throw new Error(error.message)
      return data
    }),

  staffUpdate: protectedProcedure
    .input(z.object({
      id:             z.string().uuid(),
      name:           z.string().min(1).optional(),
      email:          z.string().email().optional(),
      role:           z.enum(['teacher', 'supervisor', 'vice_director', 'director']).optional(),
      active:         z.boolean().optional(),
      telegramChatId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { id, telegramChatId, ...rest } = input
      const fields: any = { ...rest }
      if (telegramChatId !== undefined) fields.telegram_chat_id = telegramChatId
      const { data, error } = await supabase
        .from('room_staff')
        .update(fields)
        .eq('id', id)
        .eq('school_id', ctx.staff.schoolId)
        .select('id, name, email, role, active, telegram_chat_id')
        .single()
      if (error) throw new Error(error.message)
      return data
    }),

  // ── Vínculos Staff ↔ Sala ─────────────────────────────────────────────────

  staffRooms: protectedProcedure
    .input(z.object({ staffId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { data, error } = await supabase
        .from('room_classroom_staff')
        .select('classroom_id, room_classrooms(id, name, shift, segment)')
        .eq('staff_id', input.staffId)
      if (error) throw new Error(error.message)
      return data ?? []
    }),

  linkRoom: protectedProcedure
    .input(z.object({ staffId: z.string().uuid(), classroomId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { error } = await supabase
        .from('room_classroom_staff')
        .upsert({ staff_id: input.staffId, classroom_id: input.classroomId })
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  unlinkRoom: protectedProcedure
    .input(z.object({ staffId: z.string().uuid(), classroomId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.staff.role)
      const { error } = await supabase
        .from('room_classroom_staff')
        .delete()
        .eq('staff_id', input.staffId)
        .eq('classroom_id', input.classroomId)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
