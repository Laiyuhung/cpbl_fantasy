let createLeagueDisabledCache = null;
let createLeagueDisabledPromise = null;

export async function getCreateLeagueDisabled({ forceRefresh = false } = {}) {
  if (!forceRefresh && createLeagueDisabledCache !== null) {
    return createLeagueDisabledCache;
  }

  if (!forceRefresh && createLeagueDisabledPromise) {
    return createLeagueDisabledPromise;
  }

  createLeagueDisabledPromise = fetch('/api/system-settings/create-league')
    .then((res) => res.json())
    .then((data) => {
      const disabled = Boolean(data?.success && data?.disabled);
      createLeagueDisabledCache = disabled;
      return disabled;
    })
    .catch(() => {
      return false;
    })
    .finally(() => {
      createLeagueDisabledPromise = null;
    });

  return createLeagueDisabledPromise;
}