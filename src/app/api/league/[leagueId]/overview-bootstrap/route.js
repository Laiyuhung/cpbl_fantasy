import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLeagueOverviewData } from '@/lib/getLeagueOverviewData';
import supabaseAdmin from '@/lib/supabaseAdmin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getCurrentWeekFromSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) return 1;

  const now = new Date();
  const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

  const getDateInTaiwan = (dateStr) => {
    const date = new Date(dateStr);
    return new Date(date.getTime() + (8 * 60 * 60 * 1000));
  };

  const firstWeekStart = getDateInTaiwan(schedule[0].week_start);
  const lastWeekEnd = getDateInTaiwan(schedule[schedule.length - 1].week_end);

  if (taiwanTime < firstWeekStart) return 1;
  if (taiwanTime > lastWeekEnd) return schedule[schedule.length - 1].week_number;

  const current = schedule.find((w) => {
    const weekStart = getDateInTaiwan(w.week_start);
    const weekEnd = getDateInTaiwan(w.week_end);
    weekEnd.setUTCHours(23, 59, 59, 999);
    return taiwanTime >= weekStart && taiwanTime <= weekEnd;
  });

  return current?.week_number || 1;
}

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Overview bootstrap beta is admin-only' }, { status: 403 });
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', userId)
      .maybeSingle();

    if (adminError) {
      return NextResponse.json({ success: false, error: adminError.message }, { status: 500 });
    }

    if (!adminData) {
      return NextResponse.json({ success: false, error: 'Overview bootstrap beta is admin-only' }, { status: 403 });
    }

    const payload = await getLeagueOverviewData(supabase, leagueId);
    const currentWeek = getCurrentWeekFromSchedule(payload.schedule);

    const [matchupsRes, standingsRes, waiverPriorityRes, transRes, waiverRes, watchedRes] = await Promise.all([
      supabase
        .from('league_matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week_number', currentWeek),
      supabase
        .from('v_league_standings')
        .select('*')
        .eq('league_id', leagueId)
        .order('rank', { ascending: true }),
      supabase
        .from('waiver_priority')
        .select('manager_id, rank')
        .eq('league_id', leagueId),
      supabaseAdmin
        .from('transactions_2026')
        .select('*')
        .eq('league_id', leagueId)
        .order('transaction_time', { ascending: false }),
      supabaseAdmin
        .from('waiver_claims')
        .select('*')
        .eq('league_id', leagueId)
        .not('status', 'in', '("pending","canceled")')
        .lte('off_waiver', new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('watched_players')
        .select('player_id')
        .eq('league_id', leagueId)
        .eq('manager_id', userId),
    ]);

    if (matchupsRes.error) {
      return NextResponse.json({ success: false, error: matchupsRes.error.message }, { status: 500 });
    }

    if (standingsRes.error) {
      return NextResponse.json({ success: false, error: standingsRes.error.message }, { status: 500 });
    }

    if (transRes.error) {
      return NextResponse.json({ success: false, error: transRes.error.message }, { status: 500 });
    }

    if (waiverRes.error) {
      return NextResponse.json({ success: false, error: waiverRes.error.message }, { status: 500 });
    }

    if (watchedRes.error) {
      return NextResponse.json({ success: false, error: watchedRes.error.message }, { status: 500 });
    }

    const standingsWithWaiver = (standingsRes.data || []).map((team) => {
      const waiver = waiverPriorityRes.data?.find((w) => w.manager_id === team.manager_id);
      return {
        ...team,
        waiver_rank: waiver ? waiver.rank : '-',
      };
    });

    const playerIds = new Set();
    (transRes.data || []).forEach((t) => {
      if (t.player_id) playerIds.add(t.player_id);
    });
    (waiverRes.data || []).forEach((w) => {
      if (w.player_id) playerIds.add(w.player_id);
      if (w.drop_player_id) playerIds.add(w.drop_player_id);
    });

    const memberMap = {};
    (payload.members || []).forEach((m) => {
      memberMap[m.manager_id] = m.nickname;
    });

    let playerMap = {};
    if (playerIds.size > 0) {
      const ids = Array.from(playerIds);
      const [playersRes, batterPosRes, pitcherPosRes] = await Promise.all([
        supabaseAdmin
          .from('player_list')
          .select('player_id, name, batter_or_pitcher, team')
          .in('player_id', ids),
        supabaseAdmin
          .from('v_batter_positions')
          .select('*')
          .in('player_id', ids),
        supabaseAdmin
          .from('v_pitcher_positions')
          .select('*')
          .in('player_id', ids),
      ]);

      const posMap = {};
      (batterPosRes.data || []).forEach((p) => {
        posMap[p.player_id] = p.position_list;
      });
      (pitcherPosRes.data || []).forEach((p) => {
        posMap[p.player_id] = p.position_list;
      });

      if (!playersRes.error && playersRes.data) {
        playersRes.data.forEach((p) => {
          playerMap[p.player_id] = {
            ...p,
            position_list: posMap[p.player_id],
          };
        });
      }
    }

    const transactions = (transRes.data || []).map((t) => ({
      ...t,
      player: playerMap[t.player_id] || { name: 'Unknown' },
      manager: { nickname: memberMap[t.manager_id] || 'Unknown' },
    }));

    const waivers = (waiverRes.data || []).map((w) => ({
      ...w,
      player: playerMap[w.player_id] || { name: 'Unknown' },
      drop_player: w.drop_player_id ? (playerMap[w.drop_player_id] || { name: 'Unknown' }) : null,
      manager: { nickname: memberMap[w.manager_id] || 'Unknown' },
    }));

    return NextResponse.json({
      ...payload,
      apiIntegrationBeta: true,
      user: {
        manager_id: userId,
        is_admin: true,
      },
      currentWeek,
      matchups: matchupsRes.data || [],
      standings: standingsWithWaiver,
      transactions,
      waivers,
      watchedIds: (watchedRes.data || []).map((w) => w.player_id),
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 404) {
      return NextResponse.json(
        { success: false, error: 'League not found', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: statusCode }
    );
  }
}
