let homeBootstrapCache = null;
let homeBootstrapPromise = null;

export async function getHomeBootstrap({ forceRefresh = false } = {}) {
  if (!forceRefresh && homeBootstrapCache) {
    return homeBootstrapCache;
  }

  if (!forceRefresh && homeBootstrapPromise) {
    return homeBootstrapPromise;
  }

  homeBootstrapPromise = fetch('/api/home/bootstrap')
    .then((res) => res.json())
    .then((data) => {
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch home bootstrap');
      }
      homeBootstrapCache = data;
      return data;
    })
    .finally(() => {
      homeBootstrapPromise = null;
    });

  return homeBootstrapPromise;
}

export function clearHomeBootstrapCache() {
  homeBootstrapCache = null;
  homeBootstrapPromise = null;
}
