/**
 * Cria professor vinculado às turmas da escola de teste
 * Uso: node --env-file=.env.local scripts/seed-teacher.mjs
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  // Busca escola de teste
  const { data: school, error: schoolErr } = await supabase
    .from('room_schools')
    .select('id')
    .eq('access_code', 'ROOMTEST')
    .single()

  if (schoolErr || !school) {
    console.error('Escola não encontrada. Rode seed-test.mjs primeiro.')
    process.exit(1)
  }

  // Cria professor
  const hash = await bcrypt.hash('prof123', 10)
  const { data: teacher, error: profErr } = await supabase
    .from('room_staff')
    .insert({
      school_id:     school.id,
      name:          'Professor Teste',
      email:         'professor@teste.com',
      password_hash: hash,
      role:          'teacher',
    })
    .select()
    .single()

  if (profErr) {
    if (profErr.code === '23505') {
      console.log('Professor já existe. Buscando...')
      const { data } = await supabase.from('room_staff').select().eq('email', 'professor@teste.com').single()
      return linkToRooms(data.id, school.id)
    }
    throw profErr
  }

  await linkToRooms(teacher.id, school.id)
}

async function linkToRooms(teacherId, schoolId) {
  // Busca turmas
  const { data: rooms } = await supabase
    .from('room_classrooms')
    .select('id, name')
    .eq('school_id', schoolId)

  if (!rooms?.length) {
    console.error('Nenhuma turma encontrada.')
    process.exit(1)
  }

  // Vincula o professor às duas primeiras turmas
  const toLink = rooms.slice(0, 2)
  for (const room of toLink) {
    await supabase.from('room_classroom_staff').insert({
      classroom_id:   room.id,
      staff_id:       teacherId,
      subject:        'Matemática',
      is_responsible: true,
    }).select()
  }

  console.log(`\n✅ Professor criado e vinculado!`)
  console.log(`   Email: professor@teste.com`)
  console.log(`   Senha: prof123`)
  console.log(`   Role:  teacher`)
  console.log(`   Salas: ${toLink.map(r => r.name).join(', ')}`)
  console.log(`\n   Acesse: http://localhost:5175/login`)
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
