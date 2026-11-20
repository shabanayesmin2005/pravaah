/**
 * frontend/src/utils/date.ts
 * Date and time formatting helpers for IST (Indian Standard Time, UTC+5:30).
 */

/**
 * Formats a single timestamp string into IST.
 * e.g. "20 Nov 2026, 12:11 IST"
 */
export function formatIST(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' IST'
  );
}

/**
 * Formats a timestamp range into an IST display string.
 * When on the same date: "20 Nov 2026, 09:39 – 12:11 IST"
 * When spanning multiple dates: "15 Nov 2026, 05:30 – 20 Nov 2026, 12:11 IST"
 */
export function formatRangeIST(fromStr?: string | null, toStr?: string | null): string {
  if (!fromStr && !toStr) return 'All data';
  if (!fromStr && toStr) return `Up to ${formatIST(toStr)}`;
  if (fromStr && !toStr) return `From ${formatIST(fromStr)}`;

  const d1 = new Date(fromStr!);
  const d2 = new Date(toStr!);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 'All data';

  const formatterDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formatterTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const date1 = formatterDate.format(d1);
  const date2 = formatterDate.format(d2);
  const time1 = formatterTime.format(d1);
  const time2 = formatterTime.format(d2);

  if (date1 === date2) {
    return `${date1}, ${time1} – ${time2} IST`;
  }
  return `${date1}, ${time1} – ${date2}, ${time2} IST`;
}

/**
 * Formats a duration in seconds according to PRAVAAH display standards:
 * - Under 2 minutes (< 120 seconds): shown in seconds, e.g. "45 s"
 * - 2 minutes or more: shown in minutes with correct pluralization ("1 min", "5 mins")
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0 s';
  const sec = Math.round(seconds);
  if (sec < 120) {
    return `${sec} s`;
  }
  const mins = Math.round(sec / 60);
  return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
}

/**
 * Returns correctly pluralized string, e.g. "1 segment" or "3 segments".
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

