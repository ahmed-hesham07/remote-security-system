async function jsonFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  status:        ()       => jsonFetch('/api/status'),
  events:        (limit)  => jsonFetch(`/api/events?limit=${limit ?? 50}`),
  lock:          ()       => jsonFetch('/api/lock',    { method: 'POST', body: '{}' }),
  unlock:        ()       => jsonFetch('/api/unlock',  { method: 'POST', body: '{}' }),
  silence:       ()       => jsonFetch('/api/silence', { method: 'POST', body: '{}' }),
  ackEvent:      (id)     => jsonFetch(`/api/events/${id}/ack`, { method: 'POST', body: '{}' }),
  ackAll:        ()       => jsonFetch('/api/events/ack-all',   { method: 'POST', body: '{}' }),
};
