import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function POST(request) {
  const { account, password } = await request.json()

  const { data, error } = await supabase
    .from('managers')
    .select('id,must_change_password')
    .eq('account', account)
    .eq('password', password)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const response = NextResponse.json({ id: data.id, duration: 123, must_change_password: !!data.must_change_password })
  response.cookies.set('user_id', String(data.id), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false, // ✅ 預設應設 false，這樣前端 JS 可以讀（你有些頁面會用 document.cookie）
  })

  return response
}
