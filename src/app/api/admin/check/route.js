import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabase from '@/lib/supabase'

// 检查管理员权限
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId) {
      return NextResponse.json({ isAdmin: false, error: '未登录' }, { status: 401 })
    }

    // 检查是否为管理员
    const { data, error } = await supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ isAdmin: false }, { status: 200 })
    }

    return NextResponse.json({ isAdmin: true, managerId: data.manager_id }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ isAdmin: false, error: err.message }, { status: 500 })
  }
}
