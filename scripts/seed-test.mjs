/**
 * Seed de teste — cria escola + admin no Supabase
 * Uso: node --env-file=.env.local scripts/seed-test.mjs
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EMAIL    = 'admin@teste.com'
const PASSWORD = 'admin123'

async function run() {
  // Escola
  const { data: school, error: schoolErr } = await supabase
    .from('room_schools')
    .insert({ name: 'Escola Municipal Teste', city: 'Montes Claros', state: 'MG', access_code: 'ROOMTEST' })
    .select()
    .single()

  if (schoolErr) {
    if (schoolErr.code === '23505') {
      console.log('Escola já existe. Buscando...')
      const { data } = await supabase.from('room_schools').select().eq('access_code', 'ROOMTEST').single()
      return seedUser(data.id)
    }
    throw schoolErr
  }

  console.log('Escola criada:', school.id)
  await seedUser(school.id)
}

async function seedUser(schoolId) {
  const hash = await bcrypt.hash(PASSWORD, 10)

  const { data: user, error } = await supabase
    .from('room_staff')
    .insert({ school_id: schoolId, name: 'Admin Teste', email: EMAIL, password_hash: hash, role: 'admin' })
    .select()
    .single()

  if (error && error.code !== '23505') throw error

  // Turmas de exemplo
  const turmas = [
    { name: '6º A', segment: 'fund2' },
    { name: '7º B', segment: 'fund2' },
    { name: '8º C', segment: 'fund2' },
    { name: '1º EM', segment: 'medio' },
  ]

  const { data: createdRooms } = await supabase
    .from('room_classrooms')
    .insert(turmas.map(t => ({ ...t, school_id: schoolId })))
    .select()

  console.log(`\n✅ Seed concluído!`)
  console.log(`   Email:  ${EMAIL}`)
  console.log(`   Senha:  ${PASSWORD}`)
  console.log(`   Role:   admin`)
  console.log(`   Turmas: ${createdRooms?.map(r => r.name).join(', ')}`)
  console.log(`\n   Acesse: http://localhost:5176/login`)
}

run().catch(err => { console.error('❌ Erro:', err.message); process.exit(1) })
