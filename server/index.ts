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
    cb(new Error('CORS não permitido'))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }))

app.get('/health', (_, res) => res.json({ ok: true }))

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
