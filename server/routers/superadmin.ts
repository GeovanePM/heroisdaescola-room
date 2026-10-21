import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function requireSuperAdmin(role: string) {
  if (role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito ao super administrador' })
}

function generateAccessCode(name: string): string {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X')
  const num    = String(Math.floor(Math.random() * 9000) + 1000)
  return prefix + num
}

export const superAdminRouter = router({

  globalStats: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.staff.role)
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const [schoolsRes, staffRes, classroomsRes, eventsRes] = await Promise.all([
      supabase.from('room_schools').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('room_staff').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('room_classrooms').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('room_classroom_events').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ])
    return {
      activeSchools:    schoolsRes.count  ?? 0,
      activeStaff:      staffRes.count    ?? 0,
      activeClassrooms: classroomsRes.count ?? 0,
      eventsThisWeek:   eventsRes.count   ?? 0,
    }
  }),

  listSchools: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.staff.role)
    const { data: schools, error } = await supabase
      .from('room_schools')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const dayAgo  = new Date(Date.now() - 86_400_000).toISOString()

    const result = await Promise.all((schools ?? []).map(async (school: any) => {
      const { data: classroomsRaw } = await supabase
        .from('room_classrooms').select('id').eq('school_id', school.id)

      const ids = (classroomsRaw ?? []).map((c: any) => c.id)

      const [staffRes, classroomCountRes, eventsWeekRes, eventsTodayRes] = await Promise.all([
        supabase.from('room_staff').select('*', { count: 'exact', head: true })
          .eq('school_id', school.id).eq('active', true),
        supabase.from('room_classrooms').select('*', { count: 'exact', head: true })
          .eq('school_id', school.id).eq('active', true),
        ids.length
          ? supabase.from('room_classroom_events').select('*', { count: 'exact', head: true })
              .in('classroom_id', ids).gte('created_at', weekAgo)
          : Promise.resolve({ count: 0 }),
        ids.length
          ? supabase.from('room_classroom_events').select('*', { count: 'exact', head: true })
              .in('classroom_id', ids).gte('created_at', dayAgo)
          : Promise.resolve({ count: 0 }),
      ])

      return {
        ...school,
        staffCount:     staffRes.count        ?? 0,
        classroomCount: classroomCountRes.count ?? 0,
        eventsWeek:     eventsWeekRes.count    ?? 0,
        eventsToday:    eventsTodayRes.count   ?? 0,
      }
    }))

    return result
  }),

  createSchool: protectedProcedure
    .input(z.object({
      schoolName:    z.string().min(2).max(100),
      city:          z.string().min(1),
      state:         z.string().min(2).max(2),
      directorName:  z.string().min(2),
      directorEmail: z.string().email(),
      directorPass:  z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      requireSuperAdmin(ctx.staff.role)

      // Gera código único
      let accessCode = generateAccessCode(input.schoolName)
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase
          .from('room_schools').select('id').eq('access_code', accessCode).maybeSingle()
        if (!existing) break
        accessCode = generateAccessCode(input.schoolName)
      }

      const { data: school, error: sErr } = await supabase
        .from('room_schools')
        .insert({ name: input.schoolName, city: input.city, state: input.state, access_code: accessCode, active: true })
        .select().single()
      if (sErr) throw new Error(sErr.message)

      const hash = await bcrypt.hash(input.directorPass, 10)
      const { error: stErr } = await supabase
        .from('room_staff')
        .insert({
          school_id:     school.id,
          name:          input.directorName,
          email:         input.directorEmail,
          password_hash: hash,
          role:          'director',
          active:        true,
        })
      if (stErr) throw new Error(stErr.message)

      return { school, accessCode, directorEmail: input.directorEmail, directorPass: input.directorPass }
    }),

  resetDirectorPassword: protectedProcedure
    .input(z.object({ schoolId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireSuperAdmin(ctx.staff.role)

      const { data: director } = await supabase
        .from('room_staff')
        .select('id, email, name')
        .eq('school_id', input.schoolId)
        .eq('role', 'director')
        .eq('active', true)
        .maybeSingle()

      if (!director) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diretor não encontrado' })

      const chars   = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      const newPass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const hash    = await bcrypt.hash(newPass, 10)

      await supabase.from('room_staff').update({ password_hash: hash }).eq('id', director.id)

      return { email: director.email, name: director.name, password: newPass }
    }),

  toggleSchool: protectedProcedure
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      requireSuperAdmin(ctx.staff.role)
      const { error } = await supabase
        .from('room_schools').update({ active: input.active }).eq('id', input.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
