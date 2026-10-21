import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import OpenAI from 'openai'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

function requireDirector(role: string) {
  if (!['director', 'admin', 'vice_director'].includes(role))
    throw new TRPCError({ code: 'FORBIDDEN' })
}

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// Prompt de geração de questões
const SYSTEM_PROMPT = `Você é um especialista em educação brasileira para ensino fundamental e médio.
Gere questões de múltipla escolha em português brasileiro, claras, adequadas à faixa etária indicada.
Retorne SOMENTE um JSON válido (array), sem markdown, sem texto extra.`

function buildPrompt(subjectName: string, topicTitle: string, topicBody: string, count: number): string {
  return `Matéria: ${subjectName}
Tópico: ${topicTitle}
Descrição/contexto: ${topicBody || topicTitle}

Gere exatamente ${count} questões de múltipla escolha. Cada questão deve ter:
- "question": texto da pergunta (string)
- "options": array com exatamente 4 alternativas (strings curtas, sem prefixo A/B/C/D)
- "correct": índice (0 a 3) da alternativa correta
- "explanation": explicação breve (1-2 frases) do porquê a resposta está correta

Retorne apenas o JSON no formato:
[{"question":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}]`
}

export const subjectsRouter = router({

  // ── Matérias ─────────────────────────────────────────────────────────────────

  listSubjects: protectedProcedure.query(async ({ ctx }) => {
    requireDirector(ctx.staff.role)
    const { data, error } = await supabase
      .from('room_school_subjects').select('*, room_subject_topics(id, title, active)')
      .eq('school_id', ctx.staff.schoolId!).order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }),

  createSubject: protectedProcedure
    .input(z.object({
      name:        z.string().min(1).max(60),
      icon:        z.string().default('📚'),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { data, error } = await supabase
        .from('room_school_subjects')
        .insert({ ...input, school_id: ctx.staff.schoolId! })
        .select().single()
      if (error) throw new Error(error.message)
      return data
    }),

  updateSubject: protectedProcedure
    .input(z.object({
      id:          z.string().uuid(),
      name:        z.string().min(1).max(60).optional(),
      icon:        z.string().optional(),
      description: z.string().optional(),
      active:      z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { id, ...fields } = input
      const { data, error } = await supabase
        .from('room_school_subjects').update(fields)
        .eq('id', id).eq('school_id', ctx.staff.schoolId!).select().single()
      if (error) throw new Error(error.message)
      return data
    }),

  removeSubject: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { error } = await supabase
        .from('room_school_subjects')
        .delete().eq('id', input.id).eq('school_id', ctx.staff.schoolId!)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // ── Tópicos ───────────────────────────────────────────────────────────────────

  listTopics: protectedProcedure
    .input(z.object({ subjectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { data, error } = await supabase
        .from('room_subject_topics')
        .select('*, room_subject_questions(id)')
        .eq('subject_id', input.subjectId)
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []).map((t: any) => ({ ...t, questionCount: t.room_subject_questions?.length ?? 0 }))
    }),

  createTopic: protectedProcedure
    .input(z.object({
      subjectId:  z.string().uuid(),
      title:      z.string().min(1).max(100),
      body:       z.string().optional(),
      difficulty: z.number().int().min(1).max(3).default(1),
    }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      // Verifica que o subject pertence à escola
      const { data: subj } = await supabase
        .from('room_school_subjects').select('id').eq('id', input.subjectId)
        .eq('school_id', ctx.staff.schoolId!).maybeSingle()
      if (!subj) throw new TRPCError({ code: 'NOT_FOUND' })

      const { data, error } = await supabase
        .from('room_subject_topics')
        .insert({ subject_id: input.subjectId, title: input.title, body: input.body ?? null, difficulty: input.difficulty })
        .select().single()
      if (error) throw new Error(error.message)
      return data
    }),

  removeTopic: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { error } = await supabase
        .from('room_subject_topics').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // ── Geração de questões via IA ────────────────────────────────────────────────

  aiStatus: protectedProcedure.query(async ({ ctx }) => {
    requireDirector(ctx.staff.role)
    return { configured: !!process.env.OPENAI_API_KEY }
  }),

  generateQuestions: protectedProcedure
    .input(z.object({
      topicId: z.string().uuid(),
      count:   z.number().int().min(3).max(20).default(10),
    }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)

      const ai = getOpenAI()
      if (!ai) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'OPENAI_API_KEY não configurada no servidor' })

      // Carrega tópico + matéria para contexto
      const { data: topic } = await supabase
        .from('room_subject_topics')
        .select('*, room_school_subjects(name, school_id)')
        .eq('id', input.topicId).single()
      if (!topic) throw new TRPCError({ code: 'NOT_FOUND' })

      const subjectName = (topic as any).room_school_subjects?.name ?? 'Matéria'
      const schoolId    = (topic as any).room_school_subjects?.school_id

      const prompt = buildPrompt(subjectName, topic.title, topic.body ?? '', input.count)

      let parsed: any[]
      try {
        const response = await ai.chat.completions.create({
          model:       'gpt-4o-mini',
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: prompt },
          ],
        })
        const text = response.choices[0]?.message?.content ?? '[]'
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(clean)
        if (!Array.isArray(parsed)) throw new Error('Resposta inválida')
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Erro na geração: ${e.message}` })
      }

      // Valida e insere no banco
      const rows = parsed
        .filter((q: any) => q.question && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === 'number')
        .map((q: any) => ({
          topic_id:    input.topicId,
          school_id:   schoolId,
          question:    q.question,
          options:     q.options,
          correct:     q.correct,
          explanation: q.explanation ?? null,
        }))

      if (!rows.length) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Nenhuma questão válida gerada' })

      const { data, error } = await supabase
        .from('room_subject_questions').insert(rows).select()
      if (error) throw new Error(error.message)
      return { count: data?.length ?? 0, questions: data ?? [] }
    }),

  // ── Listagem / remoção de questões ────────────────────────────────────────────

  listQuestions: protectedProcedure
    .input(z.object({ topicId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { data, error } = await supabase
        .from('room_subject_questions').select('*')
        .eq('topic_id', input.topicId).order('created_at')
      if (error) throw new Error(error.message)
      return data ?? []
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { error } = await supabase
        .from('room_subject_questions').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  clearTopicQuestions: protectedProcedure
    .input(z.object({ topicId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      requireDirector(ctx.staff.role)
      const { error } = await supabase
        .from('room_subject_questions').delete().eq('topic_id', input.topicId)
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  // ── Endpoint público para o Guardiões ─────────────────────────────────────────
  // Chamado internamente via REST; também exposto como tRPC público

  questionsForTopic: publicProcedure
    .input(z.object({ topicId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('room_subject_questions')
        .select('id, question, options, correct, explanation')
        .eq('topic_id', input.topicId)
        .order('created_at')
      if (error) throw new Error(error.message)
      return data ?? []
    }),
})
