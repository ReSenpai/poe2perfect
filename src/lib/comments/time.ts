const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "2 hours ago" for the last month, then the date ("Aug 1, 2026"). */
export function relativeTime(iso: string, now: number): string {
  const elapsed = now - Date.parse(iso);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < MONTH) return plural(Math.floor(elapsed / DAY), 'day');
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Full date and time for a tooltip, e.g. "Sep 20, 2026, 10:05 AM". */
export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
