import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabaseAdmin from '@/lib/supabaseAdmin'

async function requireAdmin() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single()

  if (adminError || !adminRecord) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true }
}

export async function GET(request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')?.trim()

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId is required' }, { status: 400 })
    }

    const { data: playoffSeeds, error } = await supabaseAdmin
      .from('league_playoff_seeds')
      .select('*')
      .eq('league_id', leagueId)
      .order('seed', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch playoff seeds', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, playoffSeeds: playoffSeeds || [] })
  } catch (error) {
    console.error('[admin/playoff-seeds] GET error:', error)
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { leagueId, seeds } = body

    if (!leagueId || !Array.isArray(seeds)) {
      return NextResponse.json({ success: false, error: 'leagueId and seeds array are required' }, { status: 400 })
    }

    // 刪除該聯盟的所有舊 seed 記錄
    const { error: deleteError } = await supabaseAdmin
      .from('league_playoff_seeds')
      .delete()
      .eq('league_id', leagueId)

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Failed to delete old seeds', details: deleteError.message }, { status: 500 })
    }

    // 插入新的 seed 記錄
    const seedRows = seeds.map((seed) => ({
      league_id: leagueId,
      manager_id: seed.managerId,
      seed: seed.seed,
    }))

    const { data: insertedSeeds, error: insertError } = await supabaseAdmin
      .from('league_playoff_seeds')
      .insert(seedRows)
      .select('*')

    if (insertError) {
      return NextResponse.json({ success: false, error: 'Failed to insert seeds', details: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, playoffSeeds: insertedSeeds || [] })
  } catch (error) {
    console.error('[admin/playoff-seeds] POST error:', error)
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 })
  }
}
