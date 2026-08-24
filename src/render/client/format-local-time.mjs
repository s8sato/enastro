/**
 * Pure formatting logic for a local-timezone-aware "last modified" display
 * (REQ-UX-007). Kept separate from `local-time.mjs`'s DOM-wiring code so it
 * can be unit-tested directly from Node (mirrors the `filter.mjs` /
 * `search.mjs` split).
 *
 * `offsetMinutes` is the number of minutes *ahead* of UTC (e.g. JST is
 * +540, US Eastern Standard Time is -300) — the same sign convention as
 * `-new Date().getTimezoneOffset()`, which is what the DOM-wiring code
 * passes in for the viewer's actual local timezone.
 */

/** Just the date/time part, with no timezone suffix — used where the
 * timezone is shown once for a whole group of timestamps (e.g. the
 * Updated/Read line on note pages) rather than repeated per value. */
export function formatLocalDateOnly(epochMs, offsetMinutes) {
  const shifted = new Date(epochMs + offsetMinutes * 60_000);
  const pad = (n) => String(n).padStart(2, "0");

  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hours = pad(shifted.getUTCHours());
  const minutes = pad(shifted.getUTCMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatOffsetParts(offsetMinutes) {
  const pad = (n) => String(n).padStart(2, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  return { sign, hours, hoursPadded: pad(hours), minutesPadded: pad(minutes), minutes };
}

/** The explicit, unambiguous "(UTC+09:00)" suffix. */
export function formatTzOffsetLabel(offsetMinutes) {
  const { sign, hoursPadded, minutesPadded } = formatOffsetParts(offsetMinutes);
  return `(UTC${sign}${hoursPadded}:${minutesPadded})`;
}

/** A compact "UTC+9" / "UTC-5" / "UTC+5:30" abbreviation, for showing the
 * timezone once for a group of timestamps that all share it, instead of
 * repeating the full offset after every single value. */
export function formatTzAbbrev(offsetMinutes) {
  const { sign, hours, minutes } = formatOffsetParts(offsetMinutes);
  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatLocalTimestamp(epochMs, offsetMinutes) {
  return `${formatLocalDateOnly(epochMs, offsetMinutes)} ${formatTzOffsetLabel(offsetMinutes)}`;
}
