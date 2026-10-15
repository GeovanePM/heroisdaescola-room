import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { router, publicProcedure, protectedProcedure } from '../trpc.js'
import { supabase } from '../supabase.js'

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const { data: member, error } = await supabase
        .from('room_staff')
        .select('*')
        .eq('email', input.email)
        .maybeSingle()

      if (error || !member) throw new Error('Credenciais inválidas')
      if (!member.active)   throw new Error('Conta desativada')

      const ok = await bcrypt.compare(input.password, member.password_hash)
      if (!ok) throw new Error('Credenciais inválidas')

      const token = jwt.sign(
        { id: member.id, schoolId: member.school_id, role: member.role, name: member.name },
        process.env.APP_SECRET!,
        { expiresIn: '8h' }
      )
      return { token, role: member.role, name: member.name, schoolId: member.school_id }
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.staff),
})
