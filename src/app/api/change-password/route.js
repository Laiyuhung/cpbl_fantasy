import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function POST(request) {
  try {
    const { user_id, newPassword } = await request.json()
    if (!user_id || !newPassword) {
      return NextResponse.json({ error: 'missing parameters' }, { status: 400 })
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: '密碼至少 6 碼' }, { status: 400 })
    }

    const { data, error } = await supabase.from('managers').select('id').eq('id', user_id).single()
    if (error || !data) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 })
    }

    const { error: updErr } = await supabase
      .from('managers')
      .update({ password: newPassword, must_change_password: false })
      .eq('id', user_id)

    if (updErr) return NextResponse.json({ error: '更新密碼失敗' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
