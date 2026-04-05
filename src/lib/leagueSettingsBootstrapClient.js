const settingsBootstrapCache = new Map();
const settingsBootstrapInFlight = new Map();

function getCurrentUserId() {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie.split('; ').find((row) => row.startsWith('user_id='));
  return cookie?.split('=')[1] || '';
}

async function fetchLegacySettingsBootstrap(leagueId) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    throw new Error('Not authenticated. Please login.');
  }

  const leagueResponse = await fetch(`/api/league/${leagueId}`);
  const leagueResult = await leagueResponse.json();

  if (!leagueResponse.ok || !leagueResult.success) {
    throw new Error(leagueResult.error || 'Failed to load league data');
  }

  const currentMember = leagueResult.members?.find((m) => m.manager_id === currentUserId);

  if (!currentMember) {
    return {
      success: false,
      isAuthorized: false,
      currentUserRole: '',
      error: 'You are not a member of this league',
    };
  }

  const currentUserRole = currentMember.role;
  const isAuthorized = currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner';

  if (!isAuthorized) {
    return {
      success: false,
      isAuthorized: false,
      currentUserRole,
      error: 'Access denied. Only Commissioner or Co-Commissioner can edit league settings.',
    };
  }

  const res = await fetch(`/api/league-settings?league_id=${leagueId}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to load league settings');
  }

  let categoryWeights = { batter: {}, pitcher: {} };
  if (json.data?.scoring_type === 'Head-to-Head Fantasy Points') {
    const weightsRes = await fetch(`/api/league-settings/weights?league_id=${leagueId}`);
    const weightsJson = await weightsRes.json();
    if (weightsRes.ok && weightsJson.success) {
      categoryWeights = { batter: {}, pitcher: {} };
      (weightsJson.data || []).forEach((w) => {
        categoryWeights[w.category_type][w.category_name] = parseFloat(w.weight);
      });
    }
  }

  return {
    success: true,
    apiIntegrationBeta: false,
    isAuthorized: true,
    currentUserRole,
    status: json.status || leagueResult.status || '',
    settings: json.data,
    categoryWeights,
  };
}

export async function getLeagueSettingsBootstrap(leagueId, { forceRefresh = false } = {}) {
  if (!leagueId) {
    throw new Error('leagueId is required');
  }

  if (!forceRefresh && settingsBootstrapCache.has(leagueId)) {
    return settingsBootstrapCache.get(leagueId);
  }

  if (!forceRefresh && settingsBootstrapInFlight.has(leagueId)) {
    return settingsBootstrapInFlight.get(leagueId);
  }

  const request = (async () => {
    try {
      const betaRes = await fetch(`/api/league/${leagueId}/settings-bootstrap`);
      const betaData = await betaRes.json().catch(() => null);

      if (betaRes.ok && betaData?.success) {
        settingsBootstrapCache.set(leagueId, betaData);
        return betaData;
      }

      const legacyData = await fetchLegacySettingsBootstrap(leagueId);
      settingsBootstrapCache.set(leagueId, legacyData);
      return legacyData;
    } finally {
      settingsBootstrapInFlight.delete(leagueId);
    }
  })();

  settingsBootstrapInFlight.set(leagueId, request);
  return request;
}

export function clearLeagueSettingsBootstrapCache(leagueId) {
  if (!leagueId) return;
  settingsBootstrapCache.delete(leagueId);
  settingsBootstrapInFlight.delete(leagueId);
}
