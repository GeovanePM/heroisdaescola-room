import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const heroRouter = router({

  // Aluno vota num nome de herói para a turma
  vote: publicProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      studentName: z.string().min(1).max(60),
      heroName:    z.string().min(1).max(40),
    }))
    .mutation(async ({ input }) => {
      const { error } = await supabase
        .from('room_hero_votes')
        .insert({
          classroom_id: input.classroomId,
          student_name: input.studentName,
          hero_name:    input.heroName,
        })
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // Resultados dos votos (admin/diretor)
  results: protectedProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      if (!['admin', 'director', 'vice_director', 'supervisor'].includes(ctx.staff.role))
        throw new Error('Sem permissão')

      const { data, error } = await supabase
        .from('room_hero_votes')
        .select('hero_name')
        .eq('classroom_id', input.classroomId)

      if (error) throw new Error(error.message)

      const counts: Record<string, number> = {}
      for (const v of data ?? []) {
        const key = v.hero_name.trim().toLowerCase()
        counts[key] = (counts[key] ?? 0) + 1
      }

      return Object.entries(counts)
        .map(([name, votes]) => ({ name, votes }))
        .sort((a, b) => b.votes - a.votes)
    }),

  // Info pública da sala para página de votação
  roomInfo: publicProcedure
    .input(z.object({ classroomId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_classrooms')
        .select('id, name, shift, segment, hero_name, hero_image_url')
        .eq('id', input.classroomId)
        .maybeSingle()

      if (error || !data) throw new Error('Sala não encontrada')
      return data
    }),

  // Admin aprova um nome e salva como herói oficial
  approve: protectedProcedure
    .input(z.object({
      classroomId: z.string().uuid(),
      heroName:    z.string().min(1).max(40),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director'].includes(ctx.staff.role))
        throw new Error('Sem permissão')

      const { error } = await supabase
        .from('room_classrooms')
        .update({ hero_name: input.heroName })
        .eq('id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)

      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // Salva URL da imagem gerada externamente (fal.ai ou upload manual)
  setImage: protectedProcedure
    .input(z.object({
      classroomId:   z.string().uuid(),
      heroImageUrl:  z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!['admin', 'director'].includes(ctx.staff.role))
        throw new Error('Sem permissão')

      const { error } = await supabase
        .from('room_classrooms')
        .update({ hero_image_url: input.heroImageUrl })
        .eq('id', input.classroomId)
        .eq('school_id', ctx.staff.schoolId)

      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
