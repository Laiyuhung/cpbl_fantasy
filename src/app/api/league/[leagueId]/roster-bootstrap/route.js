import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLeagueOverviewData } from '@/lib/getLeagueOverviewData';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ROSTER_POSITION_ORDER = [
  'C', '1B', '2B', '3B', 'SS', 'MI', 'CI',
  'OF', 'LF', 'CF', 'RF', 'Util',
  'SP', 'RP', 'P',
  'BN', 'Minor',
];

function sortRosterPositions(positions) {
  if (!positions || typeof positions !== 'object') return positions;

  const sorted = {};
  ROSTER_POSITION_ORDER.forEach((pos) => {
    if (Object.prototype.hasOwnProperty.call(positions, pos)) {
      sorted[pos] = positions[pos];
    }
  });

  Object.keys(positions).forEach((pos) => {
    if (!Object.prototype.hasOwnProperty.call(sorted, pos)) {
      sorted[pos] = positions[pos];
    }
  });

  return sorted;
}

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Roster bootstrap beta is admin-only' }, { status: 403 });
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
      return NextResponse.json({ success: false, error: 'Roster bootstrap beta is admin-only' }, { status: 403 });
    }

    const [overview, settingsRes] = await Promise.all([
      getLeagueOverviewData(supabase, leagueId),
      supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .single(),
    ]);

    if (settingsRes.error || !settingsRes.data) {
      return NextResponse.json(
        { success: false, error: settingsRes.error?.message || 'League settings not found' },
        { status: 404 }
      );
    }

    const settings = { ...settingsRes.data };
    if (settings.roster_positions) {
      settings.roster_positions = sortRosterPositions(settings.roster_positions);
    }

    return NextResponse.json({
      success: true,
      apiIntegrationBeta: true,
      overview,
      settings,
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
