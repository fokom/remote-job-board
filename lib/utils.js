// Join class names, skipping falsy values.
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// "3h ago", "Yesterday", "5d ago", or a date for anything older.
export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 60) return 'Just now';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return days + 'd ago';
  return formatDate(iso);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function remoteLabel(job) {
  if (job.remote_status === 'worldwide') return 'Remote · Worldwide';
  if (job.remote_status === 'restricted') return 'Remote · ' + (job.location || 'Region limited');
  return 'Remote';
}
