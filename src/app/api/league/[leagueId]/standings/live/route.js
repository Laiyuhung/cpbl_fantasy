import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Please login first' }, { status: 401 });
    }

    // Fetch live standings from v_live_league_standings materialized view
    const { data: liveStandings, error: standingsError } = await supabaseAdmin
      .from('v_live_league_standings')
      .select('*')
      .eq('league_id', leagueId)
      .order('rank', { ascending: true });

    if (standingsError) {
      console.error('Error fetching live standings:', standingsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch live standings',
        details: standingsError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      standings: liveStandings || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Unexpected error in live standings endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred',
      details: error.message
    }, { status: 500 });
  }
}
