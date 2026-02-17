import { cookies } from 'next/headers'
import supabase from '@/lib/supabase'

export async function POST() {
  const cookieStore = cookies()
  const user_id = cookieStore.get('user_id')?.value

  if (!user_id) {
    return Response.json({ error: '未登入' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('managers')
    .select('name, email_verified')
    .eq('manager_id', user_id)
    .single()

  if (error || !data) {
    return Response.json({ error: '找不到帳號' }, { status: 404 })
  }

  // Check if user is an admin
  const { data: adminData } = await supabase
    .from('admin')
    .select('manager_id')
    .eq('manager_id', user_id)
    .single()

  const is_admin = !!adminData

  return Response.json({
    name: data.name,
    email_verified: data.email_verified,
    is_admin
  })
}
