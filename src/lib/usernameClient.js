const usernameCache = new Map();
const usernameInFlight = new Map();

function getCurrentUserId() {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie.split('; ').find((row) => row.startsWith('user_id='));
  return cookie?.split('=')[1] || '';
}

async function fetchUsernameById(userId) {
  const res = await fetch('/api/username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch username');
  }

  return data;
}

export async function getCurrentUsername({ forceRefresh = false } = {}) {
  const userId = getCurrentUserId();
  if (!userId) {
    return null;
  }

  if (!forceRefresh && usernameCache.has(userId)) {
    return usernameCache.get(userId);
  }

  if (!forceRefresh && usernameInFlight.has(userId)) {
    return usernameInFlight.get(userId);
  }

  const request = (async () => {
    try {
      const data = await fetchUsernameById(userId);
      const payload = {
        userId,
        name: data?.name || '',
        is_admin: Boolean(data?.is_admin || data?.isAdmin),
        raw: data,
      };
      usernameCache.set(userId, payload);
      return payload;
    } finally {
      usernameInFlight.delete(userId);
    }
  })();

  usernameInFlight.set(userId, request);
  return request;
}

export function clearUsernameCache() {
  usernameCache.clear();
  usernameInFlight.clear();
}