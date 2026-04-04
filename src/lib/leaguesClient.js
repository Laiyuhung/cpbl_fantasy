const inFlightLeaguesRequests = new Map();

export async function fetchManagerLeagues(userId) {
  if (!userId) return [];

  if (inFlightLeaguesRequests.has(userId)) {
    return inFlightLeaguesRequests.get(userId);
  }

  const request = fetch('/api/managers/leagues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
    .then((res) => res.json())
    .then((data) => data?.leagues || [])
    .finally(() => {
      inFlightLeaguesRequests.delete(userId);
    });

  inFlightLeaguesRequests.set(userId, request);
  return request;
}