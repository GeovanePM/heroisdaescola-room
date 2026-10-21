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
