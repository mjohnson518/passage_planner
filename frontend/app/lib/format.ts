/**
 * Display formatters for dates, durations, and distances.
 *
 * Centralised so every page renders "3 days ago", "184nm", "28h 12m" the
 * same way. Backed by date-fns where it makes sense, native Intl
 * elsewhere. Functions accept Date | string | number (timestamp) for
 * convenience — server responses often serialise dates as ISO strings.
 */

import {
  formatDistanceToNow,
  format as formatDate,
  isValid,
  parseISO,
} from "date-fns";

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === "number") {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  // Try ISO first, fall back to native Date parser.
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;
  const d = new Date(value);
  return isValid(d) ? d : null;
}

/**
 * Relative time, e.g. "3 days ago", "in 2 hours". Returns "—" if the
 * input can't be parsed so callers don't have to null-check.
 */
export function formatRelative(
  value: Date | string | number | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Calendar date for passage timelines, e.g. "Mar 14, 2026".
 */
export function formatPassageDate(
  value: Date | string | number | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDate(date, "MMM d, yyyy");
}

/**
 * Date + time in the user's local timezone, e.g. "Mar 14, 2026 · 14:30".
 * Use for save timestamps and audit log entries.
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDate(date, "MMM d, yyyy · HH:mm");
}

/**
 * Short time, e.g. "14:30". 24-hour because mariners expect ZULU/UTC
 * conventions. Caller can pass `{ withTimezone: true }` to append " UTC".
 */
export function formatTime(
  value: Date | string | number | null | undefined,
  options: { withTimezone?: boolean } = {},
): string {
  const date = toDate(value);
  if (!date) return "—";
  const base = formatDate(date, "HH:mm");
  return options.withTimezone ? `${base} UTC` : base;
}

/**
 * Duration from hours → readable, e.g. 28.5 → "28h 30m"; 1.25 → "1h 15m";
 * 48 → "2d". Used for passage ETA and watch-schedule blocks.
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null || !isFinite(hours)) return "—";
  if (hours < 0) return "—";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours - days * 24);
  const minutes = Math.round((hours - days * 24 - remainingHours) * 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (remainingHours > 0) parts.push(`${remainingHours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}

/**
 * Distance in nautical miles, e.g. 184.3 → "184nm", 1834 → "1,834nm".
 * Optional `precision` adds a decimal place for short distances.
 */
export function formatDistance(
  nm: number | null | undefined,
  options: { precision?: 0 | 1 } = {},
): string {
  if (nm == null || !isFinite(nm)) return "—";
  const precision = options.precision ?? 0;
  const rounded = nm.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return `${rounded}nm`;
}

/**
 * Compact byte / count formatter, e.g. 1234 → "1.2K", 1500000 → "1.5M".
 * Used in dashboard stats and admin metric cards.
 */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
