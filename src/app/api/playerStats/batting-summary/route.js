import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { FANTASY_POINTS_SCORING_TYPE, buildCategoryWeights, calculateFantasyPoints } from '@/lib/fantasyPoints';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeWindow = searchParams.get('time_window') || '2026 Season';
    const leagueId = searchParams.get('league_id');

    const { data, error } = await supabase
      .from('v_batting_summary')
      .select('*')
      .eq('time_window', timeWindow);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    let stats = data || [];

    if (leagueId) {
      const { data: leagueSettings } = await supabase
        .from('league_settings')
        .select('scoring_type, batter_stat_categories')
        .eq('league_id', leagueId)
        .single();

      if (leagueSettings?.scoring_type === FANTASY_POINTS_SCORING_TYPE) {
        const { data: weightRows } = await supabase
          .from('league_stat_category_weights')
          .select('category_type, category_name, weight')
          .eq('league_id', leagueId)
          .eq('category_type', 'batter');

        const categoryWeights = buildCategoryWeights(weightRows);
        const batterCategories = Array.isArray(leagueSettings.batter_stat_categories)
          ? leagueSettings.batter_stat_categories
          : [];

        stats = stats.map((row) => ({
          ...row,
          fp: calculateFantasyPoints(row, batterCategories, categoryWeights.batter),
        }));
      }
    }

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
