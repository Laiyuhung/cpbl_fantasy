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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()
    const team = searchParams.get('team')
    const type = searchParams.get('type') // batter_or_pitcher
    const identity = searchParams.get('identity')
    const available = searchParams.get('available')
    const sortBy = searchParams.get('sortBy') || 'add_date'

    let query = supabase
      .from('player_list')
      .select('*')
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
    if (identity) {
      query = query.eq('identity', identity)
    }
    if (available) {
      query = query.eq('available', available === 'true')
    }

    // 排序邏輯
    switch (sortBy) {
      case 'add_date':
        query = query.order('add_date', { ascending: false })
        break
      case 'add_date_asc':
        query = query.order('add_date', { ascending: true })
        break
      case 'name':
        query = query.order('name', { ascending: true })
        break
      case 'name_desc':
        query = query.order('name', { ascending: false })
        break
      case 'team':
        query = query.order('team', { ascending: true }).order('name', { ascending: true })
        break
      default:
        query = query.order('add_date', { ascending: false })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { name, team, original_name, batter_or_pitcher, identity } = body

    if (!name || !batter_or_pitcher) {
      return NextResponse.json({ error: 'Player name and type are required' }, { status: 400 })
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

    const newPlayer = data[0]

    // Auto-create WAIVER ownership records in all active leagues
    try {
      // Get all leagues that are NOT pre-draft or drafting now
      const { data: activeLeagues } = await supabase
        .from('league_statuses')
        .select('league_id, status')
        .not('status', 'in', '("pre-draft","drafting now")')

      if (activeLeagues && activeLeagues.length > 0) {
        // Fetch waiver_players_unfreeze_time for each active league
        const leagueIds = activeLeagues.map(l => l.league_id)
        const { data: leagueSettings } = await supabase
          .from('league_settings')
          .select('league_id, waiver_players_unfreeze_time')
          .in('league_id', leagueIds)

        const settingsMap = {}
        if (leagueSettings) {
          leagueSettings.forEach(ls => { settingsMap[ls.league_id] = ls.waiver_players_unfreeze_time })
        }

        // Calculate off_waiver for each league and build insert records
        // Taiwan time = UTC+8
        const nowTaiwan = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))

        const ownershipRecords = activeLeagues.map(league => {
          const unfreezeTime = settingsMap[league.league_id] || '2 days'
          // Parse "X days" from the setting string
          const daysMatch = unfreezeTime.match(/(\d+)/)
          const freezeDays = daysMatch ? parseInt(daysMatch[1]) : 2

          // off_waiver = today (Taiwan) + freezeDays + 1 (full days must pass)
          const offWaiverDate = new Date(nowTaiwan)
          offWaiverDate.setDate(offWaiverDate.getDate() + freezeDays + 1)
          const offWaiverStr = offWaiverDate.toISOString().split('T')[0]

          return {
            league_id: league.league_id,
            player_id: newPlayer.player_id,
            status: 'Waiver',
            manager_id: null,
            off_waiver: offWaiverStr
          }
        })

        if (ownershipRecords.length > 0) {
          const { error: ownershipError } = await supabase
            .from('league_player_ownership')
            .upsert(ownershipRecords, { onConflict: 'league_id,player_id', ignoreDuplicates: true })

          if (ownershipError) {
            console.error('Failed to create waiver ownership records:', ownershipError)
          }
        }
      }
    } catch (waiverErr) {
      // Non-blocking: log error but still return success for player creation
      console.error('Error creating waiver records:', waiverErr)
    }

    return NextResponse.json({ success: true, player: newPlayer }, { status: 201 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { player_id, name, team, original_name, batter_or_pitcher, identity, available } = body

    if (!player_id) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const playerId = searchParams.get('player_id')

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 })
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
