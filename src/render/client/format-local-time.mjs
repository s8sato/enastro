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
export function formatLocalTimestamp(epochMs, offsetMinutes) {
  const shifted = new Date(epochMs + offsetMinutes * 60_000);
  const pad = (n) => String(n).padStart(2, "0");

  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hours = pad(shifted.getUTCHours());
  const minutes = pad(shifted.getUTCMinutes());

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day} ${hours}:${minutes} (UTC${sign}${offsetHours}:${offsetMins})`;
}
