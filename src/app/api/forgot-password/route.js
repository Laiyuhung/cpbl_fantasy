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
    console.log('📥 Forgot password request:', { account, email })
    
    if (!account && !email) {
      console.log('❌ Missing both account and email')
      return NextResponse.json({ error: '請提供帳號或 email' }, { status: 400 })
    }

    const qb = supabase.from('managers').select('manager_id,email_address,account,name').limit(1)
    if (account) {
      console.log('🔍 Searching by account:', account)
      qb.eq('account', account)
    }
    if (email) {
      console.log('🔍 Searching by email:', email)
      qb.eq('email_address', email)
    }

    const { data, error } = await qb.single()
    
    console.log('📊 Query result:', { 
      found: !!data, 
      error: error?.message,
      data: data ? { manager_id: data.manager_id, email: data.email_address } : null 
    })
    
    if (error || !data) {
      console.log('❌ User not found - Error:', error)
      return NextResponse.json({ error: '找不到對應的帳號' }, { status: 404 })
    }

    const newPass = makeSixDigit()
    console.log('🔑 Generated new password (6 digits)')
    
    // Hash the new password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPass, saltRounds)
    console.log('🔒 Password hashed successfully')

    const { error: updErr } = await supabase
      .from('managers')
      .update({ password: hashedPassword, must_change_password: true })
      .eq('manager_id', data.manager_id)

    if (updErr) {
      console.error('❌ Password update error:', updErr)
      return NextResponse.json({ error: '更新密碼失敗' }, { status: 500 })
    }
    
    console.log('✅ Password updated for manager_id:', data.manager_id)

    // send email if available
    if (data.email_address) {
      console.log('📧 Preparing to send email to:', data.email_address)
      const subject = 'CPBL Fantasy - 密碼已重設'
      const message = `<p>您的密碼已被重設為 <strong>${newPass}</strong></p><p>請於下次登入後立即變更密碼。</p>`
      try {
        await sendTradeNotificationEmail(data.email_address, subject, message)
        console.log('✅ Password reset email sent successfully to:', data.email_address)
      } catch (e) {
        // log but don't fail the whole request
        console.error('❌ Email sending failed:', e)
      }
    } else {
      console.log('⚠️ No email address found for user')
    }

    console.log('✅ Forgot password process completed successfully')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('❌ Forgot password error:', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
