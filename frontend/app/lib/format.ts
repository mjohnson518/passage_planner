/**
 * Display formatters for dates, durations, and distances.
 *
 * Centralised so every page renders "3 days ago", "184nm", "28h 12m" the
 * same way. Backed by date-fns where it makes sense, native Intl
 * elsewhere. Functions accept Date | string | number (timestamp) for
 * convenience — server responses often serialise dates as ISO strings.
 */

import { format as formatDate, isValid, parseISO } from "date-fns";

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
 * Calendar date for passage timelines, e.g. "Mar 14, 2026".
 */
export function formatPassageDate(
  value: Date | string | number | null | undefined,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDate(date, "MMM d, yyyy");
}
