import { describe, expect, it } from 'vitest';
import { fullDate, relativeTime } from './time';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('says how long ago, in the largest whole unit', () => {
    expect(relativeTime(ago(20_000), NOW)).toBe('just now');
    expect(relativeTime(ago(MIN), NOW)).toBe('1 minute ago');
    expect(relativeTime(ago(45 * MIN), NOW)).toBe('45 minutes ago');
    expect(relativeTime(ago(2 * HOUR + 10 * MIN), NOW)).toBe('2 hours ago');
    expect(relativeTime(ago(DAY), NOW)).toBe('1 day ago');
    expect(relativeTime(ago(29 * DAY), NOW)).toBe('29 days ago');
  });

  it('gives the date for anything older than a month', () => {
    expect(relativeTime('2026-08-01T10:00:00Z', NOW)).toBe('Aug 1, 2026');
  });

  it('treats a date slightly in the future (clock skew) as just now', () => {
    expect(relativeTime(new Date(NOW + 30_000).toISOString(), NOW)).toBe('just now');
  });
});

describe('fullDate', () => {
  it('gives the date and time in English', () => {
    expect(fullDate('2026-09-20T10:05:00Z')).toMatch(/^Sep 20, 2026, \d{1,2}:05 (AM|PM)$/);
  });
});
