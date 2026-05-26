export function buildRosterPercentageMap({ rosterRows = [], leagueRows = [], statusRows = [], testLeagueRows = [] } = {}) {
  const testLeagueIds = new Set((testLeagueRows || []).map((row) => row.league_id));
  const activeLeagueIds = new Set(
    (statusRows || [])
      .filter((row) => row.status !== 'pre-draft' && row.status !== 'drafting now')
      .map((row) => row.league_id)
  );

  const totalLeagues = (leagueRows || []).filter(
    (row) => !testLeagueIds.has(row.league_id) && activeLeagueIds.has(row.league_id)
  ).length;

  const rosterPercentageMap = {};
  if (!Array.isArray(rosterRows) || totalLeagues <= 0) {
    return rosterPercentageMap;
  }

  const playerLeagueMap = {};
  rosterRows.forEach((row) => {
    if (testLeagueIds.has(row.league_id)) return;
    if (!playerLeagueMap[row.player_id]) playerLeagueMap[row.player_id] = new Set();
    playerLeagueMap[row.player_id].add(row.league_id);
  });

  Object.entries(playerLeagueMap).forEach(([playerId, leagues]) => {
    rosterPercentageMap[playerId] = Math.round((leagues.size / totalLeagues) * 100);
  });

  return rosterPercentageMap;
}