import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 });
    }

    const [settingsRes, scheduleRes, membersRes] = await Promise.all([
      supabase
        .from('league_settings')
        .select('league_name, scoring_type, batter_stat_categories, pitcher_stat_categories, min_innings_pitched_per_week')
        .eq('league_id', leagueId)
        .single(),
      supabase
        .from('league_schedule')
        .select('week_number, week_start, week_end, week_type, week_label, id')
        .eq('league_id', leagueId)
        .order('week_number', { ascending: true }),
      supabase
        .from('league_members')
        .select('manager_id, nickname, managers (name)')
        .eq('league_id', leagueId),
    ]);

    if (settingsRes.error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league settings', details: settingsRes.error.message }, { status: 500 });
    }

    if (scheduleRes.error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league schedule', details: scheduleRes.error.message }, { status: 500 });
    }

    if (membersRes.error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch league members', details: membersRes.error.message }, { status: 500 });
    }

    const schedule = (scheduleRes.data || []).filter((week) => week.week_type === 'regular_season');
    const weekNumbers = schedule.map((week) => week.week_number);

    let matchups = [];
    let weeklyStats = [];

    if (weekNumbers.length > 0) {
      const [matchupsRes, weeklyStatsRes] = await Promise.all([
        supabase
          .from('league_matchups')
          .select('*')
          .eq('league_id', leagueId)
          .in('week_number', weekNumbers)
          .order('week_number', { ascending: true }),
        supabase
          .from('v_weekly_manager_stats')
          .select('*')
          .eq('league_id', leagueId)
          .in('week_number', weekNumbers)
          .order('week_number', { ascending: true })
          .order('manager_id', { ascending: true }),
      ]);

      if (matchupsRes.error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch league matchups', details: matchupsRes.error.message }, { status: 500 });
      }

      if (weeklyStatsRes.error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch weekly stats', details: weeklyStatsRes.error.message }, { status: 500 });
      }

      matchups = matchupsRes.data || [];
      weeklyStats = weeklyStatsRes.data || [];
    }

    return NextResponse.json({
      success: true,
      schedule,
      availableWeeks: schedule.map((week) => week.week_number),
      matchups,
      weeklyStats,
      members: membersRes.data || [],
      settings: {
        league_name: settingsRes.data?.league_name || '',
        scoring_type: settingsRes.data?.scoring_type || '',
        batter_categories: settingsRes.data?.batter_stat_categories || [],
        pitcher_categories: settingsRes.data?.pitcher_stat_categories || [],
        min_innings_pitched_per_week: settingsRes.data?.min_innings_pitched_per_week || 0,
      },
    });
  } catch (error) {
    console.error('Record book API error:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
  }
}
