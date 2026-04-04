import { getLeagueOverview } from '@/lib/leagueOverviewClient';

const rosterBootstrapCache = new Map();
const rosterBootstrapInFlight = new Map();

async function fetchLeagueSettings(leagueId) {
  const res = await fetch(`/api/league-settings?league_id=${leagueId}`);
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to fetch league settings');
  }

  return data;
}

export async function getRosterBootstrap(leagueId, { forceRefresh = false } = {}) {
  if (!leagueId) {
    throw new Error('leagueId is required');
  }

  if (!forceRefresh && rosterBootstrapCache.has(leagueId)) {
    return rosterBootstrapCache.get(leagueId);
  }

  if (!forceRefresh && rosterBootstrapInFlight.has(leagueId)) {
    return rosterBootstrapInFlight.get(leagueId);
  }

  const request = (async () => {
    try {
      const betaRes = await fetch(`/api/league/${leagueId}/roster-bootstrap`);

      if (betaRes.ok) {
        const betaData = await betaRes.json();
        if (betaData?.success) {
          rosterBootstrapCache.set(leagueId, betaData);
          return betaData;
        }
      }

      const [overview, settings] = await Promise.all([
        getLeagueOverview(leagueId, { forceRefresh }),
        fetchLeagueSettings(leagueId),
      ]);

      const payload = {
        success: true,
        apiIntegrationBeta: false,
        overview,
        settings: settings.data || {},
      };
      rosterBootstrapCache.set(leagueId, payload);
      return payload;
    } finally {
      rosterBootstrapInFlight.delete(leagueId);
    }
  })();

  rosterBootstrapInFlight.set(leagueId, request);
  return request;
}

export function clearRosterBootstrapCache(leagueId) {
  if (!leagueId) return;
  rosterBootstrapCache.delete(leagueId);
  rosterBootstrapInFlight.delete(leagueId);
}
