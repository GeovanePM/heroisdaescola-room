import { initTRPC, TRPCError } from '@trpc/server'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import superjson from 'superjson'

export type StaffPayload = { id: string; schoolId: string; role: string; name: string }

export async function createContext({ req, res }: { req: Request; res: Response }) {
  let staff: StaffPayload | null = null
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    try {
      staff = jwt.verify(auth.slice(7), process.env.APP_SECRET!) as StaffPayload
    } catch {}
  }
  return { req, res, staff }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router    = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.staff) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, staff: ctx.staff } })
})
