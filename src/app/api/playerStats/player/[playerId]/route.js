import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    // Organize by time window
    const statsByWindow = {};
    TIME_WINDOWS.forEach(tw => {
      statsByWindow[tw] = (data || []).find(d => d.time_window === tw) || null;
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

