/**
 * Formats an epoch-millisecond timestamp as "YYYY-MM-DD HH:MM UTC"
 * (REQ-UX-007). Deliberately formatted in UTC rather than the build
 * machine's local timezone, so that the same input vault always produces
 * the same displayed/searchable timestamp text regardless of where the
 * build runs (consistent with REQ-BUILD-001's deterministic build
 * principle).
 */
export function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  const pad = (n: number): string => String(n).padStart(2, "0");

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
