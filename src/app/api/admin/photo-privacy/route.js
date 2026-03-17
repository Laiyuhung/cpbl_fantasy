import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabase from '@/lib/supabase'
import { readPhotoPrivacyConfig, writePhotoPrivacyConfig } from '@/lib/photoPrivacy'

async function isAdminRequest() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) return false

  const { data, error } = await supabase
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single()

  return !error && Boolean(data)
}

export async function GET() {
  try {
    const config = await readPhotoPrivacyConfig()
    return NextResponse.json({
      success: true,
      forceDefaultPlayerPhoto: Boolean(config.forceDefaultPlayerPhoto),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const isAdmin = await isAdminRequest()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const forceDefaultPlayerPhoto = Boolean(body?.forceDefaultPlayerPhoto)
    const updated = await writePhotoPrivacyConfig({ forceDefaultPlayerPhoto })

    return NextResponse.json({
      success: true,
      forceDefaultPlayerPhoto: Boolean(updated.forceDefaultPlayerPhoto),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
