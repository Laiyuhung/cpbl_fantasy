import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'
import bcrypt from 'bcrypt'

export async function POST(request) {
  const { email, password } = await request.json()

  // First get the user by email
  const { data, error } = await supabase
    .from('managers')
    .select('manager_id, password, must_change_password, email_verified')
    .eq('email_address', email)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Check if email is verified
  if (!data.email_verified) {
    return NextResponse.json({ error: 'Please verify your email address' }, { status: 403 })
  }

  // Compare password with hash
  const passwordMatch = await bcrypt.compare(password, data.password)
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const response = NextResponse.json({
    id: data.manager_id,
    duration: 123,
    must_change_password: !!data.must_change_password
  })
  response.cookies.set('user_id', String(data.manager_id), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // ✅ 預設應設 false，這樣前端 JS 可以讀（你有些頁面會用 document.cookie）
  })

  return response
}
