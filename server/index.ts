import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import * as trpcExpress from '@trpc/server/adapters/express'
import { appRouter } from './routers/index.js'
import { createContext } from './trpc.js'
import { getTaskPublic, handleCompletion } from './routers/task.js'
import { supabase } from './supabase.js'
import nodemailer from 'nodemailer'

const app  = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(helmet({ contentSecurityPolicy: false }))
const ALLOWED_ORIGINS = new Set([
  process.env.APP_URL,
].filter(Boolean))

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (origin.startsWith('http://localhost:')) return cb(null, true)
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true)
    // Vercel preview URLs: https://*.vercel.app
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return cb(null, true)
    // Subdomínios próprios: https://*.heroisdaescola.com.br
    if (/^https:\/\/[^.]+\.heroisdaescola\.com\.br$/.test(origin)) return cb(null, true)
    cb(new Error('CORS não permitido'))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }))

app.get('/health', (_, res) => res.json({ ok: true }))

// ── Formulário de contato da landing page ─────────────────────────────────────
function makeTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  })
}

app.post('/api/contact', async (req: any, res: any) => {
  const { nome, escola, email, msg } = req.body ?? {}
  if (!nome?.trim() || !escola?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Preencha nome, escola e e-mail.' })
  }

  const transporter = makeTransporter()
  if (!transporter) {
    console.log('[contato]', { nome, escola, email, msg })
    return res.json({ ok: true })
  }

  try {
    await transporter.sendMail({
      from: `"Heróis da Escola Room" <${process.env.SMTP_USER}>`,
      to: 'gmaciel@acaditi.com.br',
      replyTo: email,
      subject: `Novo contato — ${escola}`,
      text: `Nome: ${nome}\nEscola: ${escola}\nE-mail: ${email}\n\n${msg ?? ''}`,
      html: `<h2>Novo contato via Heróis da Escola Room</h2>
<p><b>Nome:</b> ${nome}</p>
<p><b>Escola:</b> ${escola}</p>
<p><b>E-mail:</b> <a href="mailto:${email}">${email}</a></p>
${msg ? `<p><b>Mensagem:</b><br>${msg.replace(/\n/g, '<br>')}</p>` : ''}
<hr><small>Enviado pelo formulário em room.heroisdaescola.com.br</small>`,
    })
    res.json({ ok: true })
  } catch (e: any) {
    console.error('[contato] SMTP error:', e.message)
    res.status(500).json({ error: 'Erro ao enviar. Tente novamente em instantes.' })
  }
})

// ── Endpoints públicos para o Guardiões dos Números ───────────────────────────
app.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const task = await getTaskPublic(req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' })
    res.json(task)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/tasks/:taskId/complete', async (req, res) => {
  try {
    const { studentName } = req.body
    if (!studentName || typeof studentName !== 'string' || !studentName.trim())
      return res.status(400).json({ error: 'Nome do aluno obrigatório' })
    const result = await handleCompletion(req.params.taskId, studentName)
    res.json(result)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Questões de um tópico — usado pelo Guardiões dos Números
app.get('/api/topics/:topicId/questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('room_subject_questions')
      .select('id, question, options, correct, explanation')
      .eq('topic_id', req.params.topicId)
      .order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

const httpServer = createServer(app)

// WebSocket — salas em tempo real
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', (ws, req) => {
  const roomId = new URL(req.url!, `http://localhost`).searchParams.get('roomId')
  ;(ws as any).roomId = roomId
  ws.on('error', console.error)
})

export function broadcastToRoom(roomId: string, data: object) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if ((client as any).roomId === roomId && client.readyState === 1) {
      client.send(msg)
    }
  })
}

httpServer.listen(PORT, () => {
  console.log(`[room] servidor rodando na porta ${PORT}`)
})
