import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const studentRouter = router({

  // Listar alunos de uma turma
  list: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('room_students')
        .select('*')
        .eq('classroom_id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)
        .eq('active', true)
        .order('call_number', { ascending: true, nullsFirst: false })
        .order('name')

      if (error) throw new Error(error.message)
      return data ?? []
    }),

  // Criar aluno
  create: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      name:        z.string().min(1).max(100),
      callNumber:  z.number().int().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director', 'vice_director'].includes(ctx.staff.role))
        throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await supabase
        .from('room_students')
        .insert({
          classroom_id: input.classroomId,
          school_id:    ctx.staff.schoolId,
          name:         input.name.trim(),
          call_number:  input.callNumber ?? null,
        })
        .select().single()

      if (error) throw new Error(error.message)
      return data
    }),

  // Atualizar aluno
  update: protectedProcedure
    .input(z.object({
      id:         z.string().uuid(),
      name:       z.string().min(1).max(100).optional(),
      callNumber: z.number().int().min(1).nullable().optional(),
      active:     z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director', 'vice_director'].includes(ctx.staff.role))
        throw new TRPCError({ code: 'FORBIDDEN' })

      const fields: any = {}
      if (input.name       !== undefined) fields.name        = input.name.trim()
      if (input.callNumber !== undefined) fields.call_number = input.callNumber
      if (input.active     !== undefined) fields.active      = input.active

      const { error } = await supabase
        .from('room_students')
        .update(fields)
        .eq('id', input.id)
        .eq('school_id', ctx.staff.schoolId)

      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // Remover aluno (desativa)
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director', 'vice_director'].includes(ctx.staff.role))
        throw new TRPCError({ code: 'FORBIDDEN' })

      const { error } = await supabase
        .from('room_students')
        .update({ active: false })
        .eq('id', input.id)
        .eq('school_id', ctx.staff.schoolId)

      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // Registrar presença do dia
  markAttendance: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      records: z.array(z.object({
        studentId: z.string().uuid(),
        status:    z.enum(['presente', 'falta', 'falta_justificada']),
        reason:    z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const today = new Date().toISOString().split('T')[0]

      const rows = input.records.map(r => ({
        student_id:   r.studentId,
        classroom_id: input.classroomId,
        school_id:    ctx.staff.schoolId,
        date:         today,
        status:       r.status,
        reason:       r.reason ?? null,
        recorded_by:  ctx.staff.id,
      }))

      const { error } = await supabase
        .from('room_attendance')
        .upsert(rows, { onConflict: 'student_id,date' })

      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // Presença do dia de uma turma
  attendanceToday: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid(), date: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const date = input.date ?? new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('room_attendance')
        .select('*, room_students(name, call_number)')
        .eq('classroom_id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)
        .eq('date', date)

      if (error) throw new Error(error.message)
      return data ?? []
    }),
})
