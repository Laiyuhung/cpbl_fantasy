import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const [playersRes, ownershipsRes, leagueRes, settingsRes] = await Promise.all([
      fetch(`${origin}/api/playerslist?available=true`, { cache: 'no-store' }),
      fetch(`${origin}/api/league/${leagueId}/ownership`, { cache: 'no-store' }),
      fetch(`${origin}/api/league/${leagueId}`, { cache: 'no-store' }),
      fetch(`${origin}/api/league-settings?league_id=${leagueId}`, { cache: 'no-store' }),
    ]);

    const [playersData, ownershipsData, leagueData, settingsData] = await Promise.all([
      playersRes.json(),
      ownershipsRes.json(),
      leagueRes.json(),
      settingsRes.json(),
    ]);

    if (!playersRes.ok || !playersData?.success) {
      return NextResponse.json({ success: false, error: playersData?.error || 'Failed to load players' }, { status: playersRes.status || 500 });
    }

    if (!ownershipsRes.ok || !ownershipsData?.success) {
      return NextResponse.json({ success: false, error: ownershipsData?.error || 'Failed to load ownerships' }, { status: ownershipsRes.status || 500 });
    }

    if (!leagueRes.ok || !leagueData?.success) {
      return NextResponse.json({ success: false, error: leagueData?.error || 'Failed to load league data' }, { status: leagueRes.status || 500 });
    }

    if (!settingsRes.ok || !settingsData?.success) {
      return NextResponse.json({ success: false, error: settingsData?.error || 'Failed to load league settings' }, { status: settingsRes.status || 500 });
    }

    return NextResponse.json({
      success: true,
      apiIntegrationBeta: true,
      players: playersData.players || [],
      ownerships: ownershipsData.ownerships || [],
      league: leagueData,
      settings: settingsData,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
