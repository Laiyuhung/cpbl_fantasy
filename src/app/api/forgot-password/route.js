import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'
import bcrypt from 'bcrypt'
import { sendTradeNotificationEmail } from '@/lib/email'

function makeSixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request) {
  try {
    const { account, email } = await request.json()
    if (!account && !email) {
      return NextResponse.json({ error: '請提供帳號或 email' }, { status: 400 })
    }

    const qb = supabase.from('managers').select('manager_id,email_address,account').limit(1)
    if (account) qb.eq('account', account)
    if (email) qb.eq('email_address', email)

    const { data, error } = await qb.single()
    if (error || !data) {
      return NextResponse.json({ error: '找不到對應的帳號' }, { status: 404 })
    }

    const newPass = makeSixDigit()
    
    // Hash the new password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPass, saltRounds)

    const { error: updErr } = await supabase
      .from('managers')
      .update({ password: hashedPassword, must_change_password: true })
      .eq('manager_id', data.manager_id)

    if (updErr) {
      console.error('Password update error:', updErr)
      return NextResponse.json({ error: '更新密碼失敗' }, { status: 500 })
    }

    // send email if available
    if (data.email_address) {
      const subject = 'CPBL Fantasy - 密碼已重設'
      const message = `<p>您的密碼已被重設為 <strong>${newPass}</strong></p><p>請於下次登入後立即變更密碼。</p>`
      try {
        await sendTradeNotificationEmail(data.email_address, subject, message)
        console.log('✅ Password reset email sent to:', data.email_address)
      } catch (e) {
        // log but don't fail the whole request
        console.error('❌ Email error:', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
