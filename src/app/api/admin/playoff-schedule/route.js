import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { buildPlayoffInsertPlan, parsePlayoffConfig } from '@/lib/playoffScheduleAdmin'

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

async function loadLeagueData(leagueId) {
  const [leagueRes, membersRes, scheduleRes, standingsRes, liveStandingsRes, matchupsRes] = await Promise.all([
    supabaseAdmin
      .from('league_settings')
      .select('league_id, league_name, playoffs, playoffs_start, playoff_reseeding, playoff_tie_breaker, scoring_type, start_scoring_on, max_teams, created_at, updated_at')
      .eq('league_id', leagueId)
      .single(),
    supabaseAdmin
      .from('league_members')
      .select('league_id, manager_id, nickname, role, joined_at')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true }),
    supabaseAdmin
      .from('league_schedule')
      .select('id, league_id, week_number, week_type, week_start, week_end, week_label')
      .eq('league_id', leagueId)
      .order('week_number', { ascending: true }),
    supabaseAdmin
      .from('v_league_standings')
      .select('*')
      .eq('league_id', leagueId)
      .order('rank', { ascending: true }),
    supabaseAdmin
      .from('v_live_league_standings')
      .select('*')
      .eq('league_id', leagueId)
      .order('rank', { ascending: true }),
    supabaseAdmin
      .from('league_matchups')
      .select('*')
      .eq('league_id', leagueId)
      .order('week_number', { ascending: true }),
  ])

  return {
    league: leagueRes.data || null,
    leagueError: leagueRes.error || null,
    members: membersRes.data || [],
    schedule: scheduleRes.data || [],
    standings: standingsRes.data || [],
    liveStandings: liveStandingsRes.data || [],
    matchups: matchupsRes.data || [],
  }
}

function buildInsertPayloadRows(rows, baseRows) {
  return rows.map((row, index) => {
    const baseRow = baseRows[index]
    if (!baseRow) {
      throw new Error(`Preview row ${index + 1} is missing a base row.`)
    }

    return {
      league_id: baseRow.league_id,
      week_number: baseRow.week_number,
      week_type: baseRow.week_type,
      start_date: baseRow.start_date,
      end_date: baseRow.end_date,
      manager_id_a: row?.manager_id_a ?? baseRow.manager_id_a,
      score_a: row?.score_a ?? baseRow.score_a ?? 0,
      manager_id_b: row?.manager_id_b ?? baseRow.manager_id_b,
      score_b: row?.score_b ?? baseRow.score_b ?? 0,
      winner_manager_id: row?.winner_manager_id ?? baseRow.winner_manager_id ?? null,
      is_tie: row?.is_tie ?? baseRow.is_tie ?? false,
      created_at: baseRow.created_at ?? null,
      updated_at: baseRow.updated_at ?? null,
      tie_categories_count: row?.tie_categories_count ?? baseRow.tie_categories_count ?? 0,
    }
  })
}

export async function GET(request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')?.trim()
    const targetWeekNumberParam = searchParams.get('targetWeekNumber')?.trim()
    const seedSource = String(searchParams.get('seedSource') || 'final').trim() === 'live' ? 'live' : 'final'
    const targetWeekNumber = targetWeekNumberParam ? Number(targetWeekNumberParam) : null

    const { data: leagues, error: leaguesError } = await supabaseAdmin
      .from('league_settings')
      .select('league_id, league_name, playoffs, playoffs_start, playoff_reseeding, scoring_type, start_scoring_on, max_teams, created_at')
      .order('created_at', { ascending: false })

    if (leaguesError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch leagues', details: leaguesError.message }, { status: 500 })
    }

    if (!leagueId) {
      return NextResponse.json({ success: true, leagues: leagues || [] })
    }

    const leagueData = await loadLeagueData(leagueId)
    if (leagueData.leagueError || !leagueData.league) {
      return NextResponse.json({ success: false, error: 'League not found', details: leagueData.leagueError?.message || 'No league data' }, { status: 404 })
    }

    const config = parsePlayoffConfig(leagueData.league.playoffs)
    const playoffWeeks = leagueData.schedule.filter((week) => week.week_type === 'playoffs')
    const responsePayload = {
      success: true,
      leagues: leagues || [],
      league: leagueData.league,
      config,
      members: leagueData.members,
      schedule: leagueData.schedule,
      standings: leagueData.standings,
      liveStandings: leagueData.liveStandings,
      matchups: leagueData.matchups,
      playoffWeeks,
    }

    if (Number.isInteger(targetWeekNumber)) {
      const standingsRows = seedSource === 'live' ? leagueData.liveStandings : leagueData.standings
      const playoffRows = leagueData.matchups.filter((row) => row.week_type === 'playoffs')

      const plan = buildPlayoffInsertPlan({
        leagueId,
        leagueName: leagueData.league.league_name,
        playoffsText: leagueData.league.playoffs,
        playoffReseeding: leagueData.league.playoff_reseeding,
        standingsRows,
        scheduleRows: leagueData.schedule,
        existingPlayoffRows: playoffRows,
        targetWeekNumber,
        seedSource,
      })

      if (plan.error) {
        return NextResponse.json({ ...responsePayload, success: false, error: plan.error, details: plan.error }, { status: 400 })
      }

      responsePayload.preview = plan.rows
      responsePayload.roundIndex = plan.roundIndex
      responsePayload.targetWeekNumber = targetWeekNumber
      responsePayload.seedSource = seedSource
      responsePayload.previewWeek = plan.targetWeekRow
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('[admin/playoff-schedule] GET error:', error)
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const leagueId = String(body?.leagueId || '').trim()
    const targetWeekNumber = Number(body?.targetWeekNumber)
    const seedSource = String(body?.seedSource || 'final').trim() === 'live' ? 'live' : 'final'
    const incomingRows = Array.isArray(body?.rows) ? body.rows : null

    if (!leagueId || !Number.isInteger(targetWeekNumber)) {
      return NextResponse.json({ success: false, error: 'leagueId and targetWeekNumber are required' }, { status: 400 })
    }

    const leagueData = await loadLeagueData(leagueId)
    if (!leagueData.league) {
      return NextResponse.json({ success: false, error: 'League not found' }, { status: 404 })
    }

    const standingsRows = seedSource === 'live' ? leagueData.liveStandings : leagueData.standings
    const playoffRows = leagueData.matchups.filter((row) => row.week_type === 'playoffs')

    const plan = buildPlayoffInsertPlan({
      leagueId,
      leagueName: leagueData.league.league_name,
      playoffsText: leagueData.league.playoffs,
      playoffReseeding: leagueData.league.playoff_reseeding,
      standingsRows,
      scheduleRows: leagueData.schedule,
      existingPlayoffRows: playoffRows,
      targetWeekNumber,
      seedSource,
    })

    if (plan.error) {
      return NextResponse.json({ success: false, error: plan.error }, { status: 400 })
    }

    if (incomingRows && incomingRows.length !== plan.rows.length) {
      return NextResponse.json({
        success: false,
        error: `Preview row count mismatch. Expected ${plan.rows.length}, received ${incomingRows.length}.`,
      }, { status: 400 })
    }

    const insertPayload = incomingRows && incomingRows.length > 0
      ? buildInsertPayloadRows(incomingRows, plan.rows)
      : plan.rows.map(({ rowKey, matchup_label, matchup_type, left_seed, right_seed, left_nickname, right_nickname, ...dbRow }) => dbRow)

    const existingRows = playoffRows.filter((row) => Number(row.week_number) === Number(targetWeekNumber))
    if (existingRows.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('league_matchups')
        .delete()
        .eq('league_id', leagueId)
        .eq('week_number', targetWeekNumber)
        .eq('week_type', 'playoffs')

      if (deleteError) {
        return NextResponse.json({ success: false, error: 'Failed to clear existing playoff rows', details: deleteError.message }, { status: 500 })
      }
    }

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from('league_matchups')
      .insert(insertPayload)
      .select('*')

    if (insertError) {
      return NextResponse.json({ success: false, error: 'Failed to insert playoff rows', details: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inserted: insertedRows || [],
      preview: plan.rows,
      roundIndex: plan.roundIndex,
      targetWeekNumber,
      seedSource,
      config: plan.config,
    })
  } catch (error) {
    console.error('[admin/playoff-schedule] POST error:', error)
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 })
  }
}
