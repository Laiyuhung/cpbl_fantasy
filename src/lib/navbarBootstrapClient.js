const navbarBootstrapCache = {
  data: null,
  inFlight: null,
};

export async function getNavbarBootstrap({ forceRefresh = false } = {}) {
  if (!forceRefresh && navbarBootstrapCache.data) {
    return navbarBootstrapCache.data;
  }

  if (!forceRefresh && navbarBootstrapCache.inFlight) {
    return navbarBootstrapCache.inFlight;
  }

  navbarBootstrapCache.inFlight = fetch('/api/navbar/bootstrap')
    .then((res) => res.json())
    .then((data) => {
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch navbar bootstrap');
      }
      navbarBootstrapCache.data = data;
      return data;
    })
    .finally(() => {
      navbarBootstrapCache.inFlight = null;
    });

  return navbarBootstrapCache.inFlight;
}

export function clearNavbarBootstrapCache() {
  navbarBootstrapCache.data = null;
  navbarBootstrapCache.inFlight = null;
}
