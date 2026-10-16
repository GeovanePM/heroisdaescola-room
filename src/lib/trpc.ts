import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '../../server/routers/index.js'

export const trpc = createTRPCReact<AppRouter>()

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3001'}/api/trpc`,
        headers() {
          const token = localStorage.getItem('room_token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
        transformer: superjson,
      }),
    ],
  })
}
