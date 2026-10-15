import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: teacher } = await supabase
  .from('room_staff')
  .select('id, name, role')
  .eq('email', 'professor@teste.com')
  .single()

console.log('Teacher:', teacher)

const { data: links, error } = await supabase
  .from('room_classroom_staff')
  .select('*, room_classrooms(name)')
  .eq('staff_id', teacher.id)

console.log('Links error:', error)
console.log('Links:', JSON.stringify(links, null, 2))
