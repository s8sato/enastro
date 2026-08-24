/**
 * Progressively enhances the server-rendered "last modified" timestamp
 * (baked in as a fixed UTC string for deterministic-build reasons, see
 * `src/render/format-timestamp.ts`) to display in the *viewer's own*
 * local timezone instead (REQ-UX-007). Runs directly in the browser as an
 * ES module; no bundler/build step needed.
 *
 * Only the date/time value itself is rewritten — the "Updated" label is
 * static markup (`page.ts`), and the timezone is shown once for the whole
 * Updated/Read line via `[data-tz]` rather than repeated per value.
 *
 * If JavaScript is unavailable, the page still shows the UTC fallback text
 * that was rendered server-side, so this is purely progressive enhancement.
 */
import { formatLocalDateOnly, formatTzAbbrev } from "./format-local-time.mjs";

function main() {
  const offsetMinutes = -new Date().getTimezoneOffset();

  for (const el of document.querySelectorAll("[data-modified]")) {
    const epochMs = Number(el.dataset.modified);
    if (Number.isNaN(epochMs)) {
      continue;
    }
    el.textContent = formatLocalDateOnly(epochMs, offsetMinutes);
  }

  for (const el of document.querySelectorAll("[data-tz]")) {
    el.textContent = formatTzAbbrev(offsetMinutes);
  }
}

main();
