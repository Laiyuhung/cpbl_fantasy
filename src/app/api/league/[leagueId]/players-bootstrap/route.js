import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value || null;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const origin = new URL(request.url).origin;
        const todayResponse = await fetch(`${origin}/api/starting-status?date=${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })}`, { cache: 'no-store' });
        const todayData = await todayResponse.json().catch(() => null);
        const todayDate = todayResponse.ok && todayData?.success ? (todayData.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })) : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        const defaultTimeWindow = '2026 Season';

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

        const userRequests = userId
          ? [
              fetch(`${origin}/api/league/${leagueId}/roster?manager_id=${userId}&game_date=${todayDate}`, { cache: 'no-store' }),
              fetch(`${origin}/api/league/${leagueId}/acquisitions?manager_id=${userId}`, { cache: 'no-store' }),
              fetch(`${origin}/api/trade/list?league_id=${leagueId}&manager_id=${userId}`, { cache: 'no-store' }),
              fetch(`${origin}/api/watched?league_id=${leagueId}&manager_id=${userId}`, { cache: 'no-store' }),
              fetch(`${origin}/api/playerStats/batting-summary?time_window=${encodeURIComponent(defaultTimeWindow)}&league_id=${encodeURIComponent(leagueId)}`, { cache: 'no-store' }),
              fetch(`${origin}/api/league/${leagueId}/rankings?time_window=${encodeURIComponent(defaultTimeWindow)}`, { cache: 'no-store' }),
            ]
          : [];

        const [rosterRes, acquisitionsRes, tradesRes, watchedRes, battingStatsRes, rankingsRes] = userRequests.length
          ? await Promise.all(userRequests)
          : [];

        const [rosterData, acquisitionsData, tradesData, watchedData, battingStatsData, rankingsData] = userRequests.length
          ? await Promise.all([
              rosterRes.json().catch(() => null),
              acquisitionsRes.json().catch(() => null),
              tradesRes.json().catch(() => null),
              watchedRes.json().catch(() => null),
              battingStatsRes.json().catch(() => null),
              rankingsRes.json().catch(() => null),
            ])
          : [null, null, null, null, null, null];

        const initialRosterLockMap = {};
        if (rosterRes?.ok && rosterData?.success && Array.isArray(rosterData.roster)) {
          rosterData.roster.forEach((item) => {
            initialRosterLockMap[String(item.player_id)] = item;
          });
        }

        const activeTradePlayerIds = new Set();
        if (tradesRes?.ok && tradesData?.success && Array.isArray(tradesData.trades)) {
          tradesData.trades.forEach((trade) => {
            const status = String(trade.status || '').toLowerCase();
            if (status === 'pending' || status === 'accepted') {
              (trade.initiator_player_ids || []).forEach((id) => activeTradePlayerIds.add(id));
              (trade.recipient_player_ids || []).forEach((id) => activeTradePlayerIds.add(id));
            }
          });
        }

        const playerStats = {};
        if (battingStatsRes?.ok && battingStatsData?.success && Array.isArray(battingStatsData.stats)) {
          battingStatsData.stats.forEach((stat) => {
            playerStats[stat.player_id] = stat;
          });
        }

        const playerRankings = {};
        if (rankingsRes?.ok && rankingsData?.success && Array.isArray(rankingsData.rankings)) {
          rankingsData.rankings.forEach((row) => {
            playerRankings[row.player_id] = row.rank;
          });
        }

    return NextResponse.json({
      success: true,
      apiIntegrationBeta: true,
      players: playersData.players || [],
      ownerships: ownershipsData.ownerships || [],
      league: leagueData,
      settings: settingsData,
            startingStatus: todayData?.success ? (todayData.data || null) : null,
            acquisitionData: acquisitionsData?.success ? acquisitionsData : null,
            activeTradePlayerIds: Array.from(activeTradePlayerIds),
            watchedIds: watchedData?.success ? (watchedData.watchedIds || []) : [],
            myRosterLockMap: initialRosterLockMap,
            playerStats,
            playerRankings,
            timeWindow: defaultTimeWindow,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
