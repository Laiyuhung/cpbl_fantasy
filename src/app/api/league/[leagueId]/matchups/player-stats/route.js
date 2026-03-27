import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FANTASY_POINTS_SCORING_TYPE, buildCategoryWeights, calculateFantasyPoints } from '@/lib/fantasyPoints';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const managerId = searchParams.get('manager_id');

    if (!leagueId || !week) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const { data: leagueSettings } = await supabase
      .from('league_settings')
      .select('scoring_type, batter_stat_categories, pitcher_stat_categories')
      .eq('league_id', leagueId)
      .single();

    let categoryWeights = { batter: {}, pitcher: {} };
    if (leagueSettings?.scoring_type === FANTASY_POINTS_SCORING_TYPE) {
      const { data: weightRows } = await supabase
        .from('league_stat_category_weights')
        .select('category_type, category_name, weight')
        .eq('league_id', leagueId);
      categoryWeights = buildCategoryWeights(weightRows);
    }

    // Build query for batting stats
    let battingQuery = supabase
      .from('v_weekly_league_batting_stats')
      .select('*')
      .eq('league_id', leagueId)
      .eq('week_number', parseInt(week));
    
    if (managerId) {
      battingQuery = battingQuery.eq('manager_id', managerId);
    }

    // Build query for pitching stats  
    let pitchingQuery = supabase
      .from('v_weekly_league_pitching_stats')
      .select('*')
      .eq('league_id', leagueId)
      .eq('week_number', parseInt(week));
    
    if (managerId) {
      pitchingQuery = pitchingQuery.eq('manager_id', managerId);
    }

    // Execute both queries in parallel
    const [battingResult, pitchingResult] = await Promise.all([
      battingQuery,
      pitchingQuery
    ]);

    if (battingResult.error) {
      console.error('Batting stats error:', battingResult.error);
      return NextResponse.json({ success: false, error: battingResult.error.message }, { status: 500 });
    }

    if (pitchingResult.error) {
      console.error('Pitching stats error:', pitchingResult.error);
      return NextResponse.json({ success: false, error: pitchingResult.error.message }, { status: 500 });
    }

    // Get player names for the stats
    const battingPlayerIds = [...new Set(battingResult.data.map(s => s.player_id).filter(Boolean))];
    const pitchingPlayerIds = [...new Set(pitchingResult.data.map(s => s.player_id).filter(Boolean))];
    const allPlayerIds = [...new Set([...battingPlayerIds, ...pitchingPlayerIds])];

    let playerMap = {};
    if (allPlayerIds.length > 0) {
      const { data: players, error: playersError } = await supabase
        .from('player_list')
        .select('player_id, name, team')
        .in('player_id', allPlayerIds);
      
      if (!playersError && players) {
        players.forEach(p => {
          playerMap[p.player_id] = p;
        });
      }
    }

    // Enrich stats with player names
    const battingStats = battingResult.data.map(stat => ({
      ...stat,
      player_name: playerMap[stat.player_id]?.name || 'Unknown',
      player_team: playerMap[stat.player_id]?.team || '',
      fp: leagueSettings?.scoring_type === FANTASY_POINTS_SCORING_TYPE
        ? calculateFantasyPoints(stat, leagueSettings.batter_stat_categories || [], categoryWeights.batter)
        : null
    }));

    const pitchingStats = pitchingResult.data.map(stat => ({
      ...stat,
      player_name: playerMap[stat.player_id]?.name || 'Unknown',
      player_team: playerMap[stat.player_id]?.team || '',
      fp: leagueSettings?.scoring_type === FANTASY_POINTS_SCORING_TYPE
        ? calculateFantasyPoints(stat, leagueSettings.pitcher_stat_categories || [], categoryWeights.pitcher)
        : null
    }));

    return NextResponse.json({
      success: true,
      batting: battingStats,
      pitching: pitchingStats
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
