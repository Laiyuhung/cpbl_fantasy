import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FANTASY_POINTS_SCORING_TYPE, buildCategoryWeights, calculateFantasyPoints } from '@/lib/fantasyPoints';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TIME_WINDOWS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 14 Days',
  'Last 30 Days',
  '2026 Season',
  '2026 Spring Training',
  '2025 Season'
];

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const playerId = resolvedParams.playerId;

    if (!playerId || playerId === 'undefined' || playerId === 'null') {
      return NextResponse.json({ success: false, error: 'Invalid playerId' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'batter' or 'pitcher'
    const leagueId = searchParams.get('league_id');

    // Determine player type
    let isPitcher = type === 'pitcher';
    if (!type) {
      const { data: playerInfo } = await supabase
        .from('player_list')
        .select('batter_or_pitcher')
        .eq('player_id', playerId)
        .single();

      if (playerInfo) {
        isPitcher = playerInfo.batter_or_pitcher === 'pitcher';
      }
    }

    // Query the appropriate view
    const viewName = isPitcher ? 'v_pitching_summary' : 'v_batting_summary';
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .eq('player_id', playerId)
      .in('time_window', TIME_WINDOWS);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let scoringType = '';
    let scopedCategories = [];
    let scopedWeights = {};

    if (leagueId) {
      const { data: leagueSettings } = await supabase
        .from('league_settings')
        .select('scoring_type, batter_stat_categories, pitcher_stat_categories')
        .eq('league_id', leagueId)
        .single();

      scoringType = leagueSettings?.scoring_type || '';

      if (scoringType === FANTASY_POINTS_SCORING_TYPE) {
        const { data: weightRows } = await supabase
          .from('league_stat_category_weights')
          .select('category_type, category_name, weight')
          .eq('league_id', leagueId);

        const categoryWeights = buildCategoryWeights(weightRows);
        if (isPitcher) {
          scopedCategories = Array.isArray(leagueSettings?.pitcher_stat_categories) ? leagueSettings.pitcher_stat_categories : [];
          scopedWeights = categoryWeights.pitcher;
        } else {
          scopedCategories = Array.isArray(leagueSettings?.batter_stat_categories) ? leagueSettings.batter_stat_categories : [];
          scopedWeights = categoryWeights.batter;
        }
      }
    }

    // Organize by time window
    const statsByWindow = {};
    TIME_WINDOWS.forEach(tw => {
      const row = (data || []).find(d => d.time_window === tw) || null;
      if (row && scoringType === FANTASY_POINTS_SCORING_TYPE) {
        statsByWindow[tw] = {
          ...row,
          fp: calculateFantasyPoints(row, scopedCategories, scopedWeights),
        };
      } else {
        statsByWindow[tw] = row;
      }
    });

    return NextResponse.json({
      success: true,
      batting: isPitcher ? {} : statsByWindow,
      pitching: isPitcher ? statsByWindow : {},
      isPitcher
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
  }
}

