function parseTs(value) {
  if (!value) return null;
  // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('T')) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

export function formatTime(value) {
  const d = parseTs(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelative(value) {
  const d = parseTs(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);

  if (sec < 5)         return 'just now';
  if (sec < 60)        return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60)        return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)         return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}
