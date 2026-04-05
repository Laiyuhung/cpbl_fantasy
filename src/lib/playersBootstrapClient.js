const playersBootstrapCache = new Map();
const playersBootstrapInFlight = new Map();

async function fetchLegacyPlayersBootstrap(leagueId) {
  const [playersRes, ownershipsRes, leagueRes, settingsRes] = await Promise.all([
    fetch('/api/playerslist?available=true'),
    fetch(`/api/league/${leagueId}/ownership`),
    fetch(`/api/league/${leagueId}`),
    fetch(`/api/league-settings?league_id=${leagueId}`),
  ]);

  const [playersData, ownershipsData, leagueData, settingsData] = await Promise.all([
    playersRes.json(),
    ownershipsRes.json(),
    leagueRes.json(),
    settingsRes.json(),
  ]);

  if (!playersRes.ok || !playersData?.success) {
    throw new Error(playersData?.error || 'Failed to load players');
  }

  return {
    success: true,
    apiIntegrationBeta: false,
    players: playersData.players || [],
    ownerships: ownershipsData?.ownerships || [],
    league: leagueData?.success ? leagueData : null,
    settings: settingsData?.success ? settingsData : null,
  };
}

export async function getPlayersBootstrap(leagueId, { forceRefresh = false } = {}) {
  if (!leagueId) {
    throw new Error('leagueId is required');
  }

  if (!forceRefresh && playersBootstrapCache.has(leagueId)) {
    return playersBootstrapCache.get(leagueId);
  }

  if (!forceRefresh && playersBootstrapInFlight.has(leagueId)) {
    return playersBootstrapInFlight.get(leagueId);
  }

  const request = (async () => {
    try {
      const betaRes = await fetch(`/api/league/${leagueId}/players-bootstrap`);
      const betaData = await betaRes.json().catch(() => null);

      if (betaRes.ok && betaData?.success) {
        playersBootstrapCache.set(leagueId, betaData);
        return betaData;
      }

      const legacyData = await fetchLegacyPlayersBootstrap(leagueId);
      playersBootstrapCache.set(leagueId, legacyData);
      return legacyData;
    } finally {
      playersBootstrapInFlight.delete(leagueId);
    }
  })();

  playersBootstrapInFlight.set(leagueId, request);
  return request;
}

export function clearPlayersBootstrapCache(leagueId) {
  if (!leagueId) return;
  playersBootstrapCache.delete(leagueId);
  playersBootstrapInFlight.delete(leagueId);
}
