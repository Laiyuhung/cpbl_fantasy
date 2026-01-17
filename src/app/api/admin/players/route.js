import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabase from '@/lib/supabase'

// 验证管理员权限
async function checkAdmin(userId) {
  const { data, error } = await supabase
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single()
  
  return !error && data
}

// GET - 获取所有球员
export async function GET(req) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId || !(await checkAdmin(userId))) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()
    const team = searchParams.get('team')
    const type = searchParams.get('type') // batter_or_pitcher

    let query = supabase
      .from('player_list')
      .select('*')
      .order('add_date', { ascending: false })
      .limit(500) // 限制最大返回 500 條結果

    // 只在搜尋字串至少 1 個字元時才進行搜尋
    if (search && search.length > 0) {
      query = query.or(`name.ilike.%${search}%,original_name.ilike.%${search}%`)
    }
    if (team) {
      query = query.eq('team', team)
    }
    if (type) {
      query = query.eq('batter_or_pitcher', type)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ players: data }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - 新增球员
export async function POST(req) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId || !(await checkAdmin(userId))) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const body = await req.json()
    const { name, team, original_name, batter_or_pitcher, identity } = body

    if (!name || !batter_or_pitcher) {
      return NextResponse.json({ error: '球员名称和类型为必填' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('player_list')
      .insert([
        {
          name,
          team: team || null,
          original_name: original_name || null,
          batter_or_pitcher,
          identity: identity || 'local',
          add_date: new Date().toISOString().split('T')[0],
          available: true
        }
      ])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, player: data[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT - 更新球员
export async function PUT(req) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId || !(await checkAdmin(userId))) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const body = await req.json()
    const { player_id, name, team, original_name, batter_or_pitcher, identity, available } = body

    if (!player_id) {
      return NextResponse.json({ error: '球员 ID 为必填' }, { status: 400 })
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (team !== undefined) updateData.team = team
    if (original_name !== undefined) updateData.original_name = original_name
    if (batter_or_pitcher !== undefined) updateData.batter_or_pitcher = batter_or_pitcher
    if (identity !== undefined) updateData.identity = identity
    if (available !== undefined) updateData.available = available

    const { data, error } = await supabase
      .from('player_list')
      .update(updateData)
      .eq('player_id', player_id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, player: data[0] }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - 删除球员
export async function DELETE(req) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value

    if (!userId || !(await checkAdmin(userId))) {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const playerId = searchParams.get('player_id')

    if (!playerId) {
      return NextResponse.json({ error: '球员 ID 为必填' }, { status: 400 })
    }

    const { error } = await supabase
      .from('player_list')
      .delete()
      .eq('player_id', playerId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
