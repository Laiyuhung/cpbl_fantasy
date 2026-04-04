const overviewCache = new Map();
const overviewInFlight = new Map();

async function fetchLegacyOverview(leagueId) {
  const res = await fetch(`/api/league/${leagueId}`);
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to fetch league overview');
  }

  return {
    ...data,
    apiIntegrationBeta: false,
  };
}

export async function getLeagueOverview(leagueId, { forceRefresh = false } = {}) {
  if (!leagueId) {
    throw new Error('leagueId is required');
  }

  if (!forceRefresh && overviewCache.has(leagueId)) {
    return overviewCache.get(leagueId);
  }

  if (!forceRefresh && overviewInFlight.has(leagueId)) {
    return overviewInFlight.get(leagueId);
  }

  const request = (async () => {
    try {
      const betaRes = await fetch(`/api/league/${leagueId}/overview-bootstrap`);

      if (betaRes.ok) {
        const betaData = await betaRes.json();
        if (betaData?.success) {
          const payload = {
            ...betaData,
            apiIntegrationBeta: Boolean(betaData.apiIntegrationBeta),
          };
          overviewCache.set(leagueId, payload);
          return payload;
        }
      }

      // 403 means user is not in beta; fall back to legacy endpoint.
      if (betaRes.status !== 403) {
        const betaData = await betaRes.json().catch(() => null);
        if (betaData?.error) {
          console.warn('overview-bootstrap fallback:', betaData.error);
        }
      }

      const legacyPayload = await fetchLegacyOverview(leagueId);
      overviewCache.set(leagueId, legacyPayload);
      return legacyPayload;
    } finally {
      overviewInFlight.delete(leagueId);
    }
  })();

  overviewInFlight.set(leagueId, request);
  return request;
}

export function clearLeagueOverviewCache(leagueId) {
  if (!leagueId) return;
  overviewCache.delete(leagueId);
  overviewInFlight.delete(leagueId);
}
