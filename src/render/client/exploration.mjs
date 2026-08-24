/**
 * Client-side "exploration status" (REQ-EXPLORE-001~005): tracks per-note
 * read/unread state entirely in the browser's localStorage. This state is
 * never written to any build artifact (graph.json, search-index.json,
 * generated HTML) — see spec/08-security-and-privacy.md's privacy
 * invariant, which this feature must not violate. Runs directly in the
 * browser as an ES module; no bundler/build step needed.
 *
 * Data model: an append-only event log, `{id, status, ts}[]`, stored under
 * STORAGE_KEY. The *current* status of a note is derived by folding the
 * log up to a given point in time (a "cursor"): later events for the same
 * id override earlier ones. This is what lets the rewind UI show the
 * list/graph as it looked at any past moment without ever deleting
 * history (REQ-EXPLORE-003).
 *
 * Status is keyed purely by note id, so it survives graph topology changes
 * (added/removed nodes or edges) unaffected (REQ-EXPLORE-004): ids no
 * longer present are simply never looked up by the index/graph pages, and
 * new ids default to "unread".
 *
 * The rewind cursor itself is *not* persisted across page loads — it is
 * plain in-memory UI state, reset to "now" (live) on every navigation/
 * reload, since it is only meant for momentarily reviewing history within
 * the current session.
 *
 * Two operations *do* permanently rewrite the log, as an explicit,
 * user-confirmed exception to the above (ADR-0014, "Reset to here" /
 * "Prune until here"): `resetLogAt()` actually reverts to the rewound
 * state by discarding every event *after* the cursor (like `git reset
 * --hard`), and `pruneLogUntil()` removes no-op (net-unchanged) event
 * pairs from the range up to the cursor. Both are pure functions; the
 * DOM-wiring code below is responsible for persisting their result and
 * requires an explicit confirmation before doing so.
 */
import { formatLocalDateOnly } from "./format-local-time.mjs";

export const STORAGE_KEY = "enastro:exploration:v1";

/**
 * Sentinel cursor value representing the "initial state" — before any
 * event has ever been recorded (all notes implicitly unread). Folding the
 * log up to this cursor (`computeStatusAsOf(log, INITIAL_CURSOR_TS)`)
 * naturally yields an empty status map, since every real event's `ts` is a
 * `Date.now()` value and therefore always greater than `-Infinity`. This
 * lets the initial state be selected from the History list exactly like
 * any other rewind target, without any special-casing in the pure
 * log/status functions above.
 */
export const INITIAL_CURSOR_TS = Number.NEGATIVE_INFINITY;

/** Reads the raw event log from localStorage. Returns [] if absent/corrupt. */
export function loadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Appends a new `{id, status, ts}` event and attempts to persist the
 * updated log to localStorage.
 * @param {{id: string, status: string, ts: number}[]} log
 * @param {string} id
 * @param {string} status
 * @returns {{log: {id: string, status: string, ts: number}[], ok: boolean, error?: unknown}}
 *   the updated (in-memory) log, and whether the write to localStorage
 *   succeeded. On failure (e.g. a QuotaExceededError), the event is still
 *   included in the returned `log` so the current page can reflect it
 *   immediately, but it will not survive a reload (REQ-EXPLORE-002).
 */
export function appendEvent(log, id, status) {
  const nextLog = [...log, { id, status, ts: Date.now() }];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLog));
    return { log: nextLog, ok: true };
  } catch (error) {
    return { log: nextLog, ok: false, error };
  }
}

/**
 * Folds the event log up to (and including) `cursorTs` into a Map of
 * id -> status. Events are assumed to already be in chronological order
 * (as produced by `appendEvent`); events with a later `ts` than `cursorTs`
 * are ignored, which is what makes rewinding possible.
 * @param {{id: string, status: string, ts: number}[]} log
 * @param {number} [cursorTs] defaults to Infinity (i.e. "now"/live).
 * @returns {Map<string, string>}
 */
export function computeStatusAsOf(log, cursorTs = Infinity) {
  const statusById = new Map();
  for (const event of log) {
    if (event.ts > cursorTs) continue;
    statusById.set(event.id, event.status);
  }
  return statusById;
}

/**
 * Returns the `ts` of the most recent event for `id` with `ts <= cursorTs`
 * (chronologically last, regardless of status), or `undefined` if there is
 * none. When the current status for `id` is "read", this is exactly the
 * "read at" timestamp for the read/unread indicator on note pages.
 * @param {{id: string, status: string, ts: number}[]} log
 * @param {string} id
 * @param {number} [cursorTs]
 * @returns {number | undefined}
 */
export function getLastEventTimestamp(log, id, cursorTs = Infinity) {
  let lastTs;
  for (const event of log) {
    if (event.ts > cursorTs || event.id !== id) continue;
    lastTs = event.ts;
  }
  return lastTs;
}

/**
 * "Reset to here" (ADR-0014): actually reverts to the state as it was at
 * the rewound cursor, by permanently discarding every event *after*
 * `cursorTs` (like `git reset --hard`). Events at/before `cursorTs` are
 * left completely untouched — this does *not* collapse or rewrite past
 * history, only truncates the future relative to the cursor. This is a
 * one-way, destructive rewrite of the log — callers (the DOM-wiring code
 * below) are responsible for requiring explicit user confirmation before
 * persisting the result.
 * @param {{id: string, status: string, ts: number}[]} log
 * @param {number} cursorTs
 * @returns {{id: string, status: string, ts: number}[]}
 */
export function resetLogAt(log, cursorTs) {
  return log.filter((event) => event.ts <= cursorTs);
}

/**
 * "Prune until here" (ADR-0014): removes, from the range `(-∞, cursorTs]`,
 * any per-id event history that nets out to no change from the implicit
 * default ("unread", i.e. absent from the log) — a "read"→"unread"
 * round-trip within that range annihilates entirely. IDs whose net status
 * within the range is "read" keep only their single last qualifying event;
 * all earlier events for that id within the range are dropped. Events
 * after `cursorTs` are untouched. Also a one-way, destructive rewrite; see
 * `resetLogAt()`'s doc comment for the same caveat.
 * @param {{id: string, status: string, ts: number}[]} log
 * @param {number} cursorTs
 * @returns {{id: string, status: string, ts: number}[]}
 */
export function pruneLogUntil(log, cursorTs) {
  const lastEventByIdInWindow = new Map();
  for (const event of log) {
    if (event.ts > cursorTs) continue;
    lastEventByIdInWindow.set(event.id, event);
  }
  const kept = log.filter((event) => event.ts > cursorTs);
  for (const lastEvent of lastEventByIdInWindow.values()) {
    if (lastEvent.status === "read") {
      kept.push(lastEvent);
    }
  }
  kept.sort((a, b) => a.ts - b.ts);
  return kept;
}

/**
 * Parses a `search-index.json` entry's `modifiedAt` string (e.g.
 * "2026-08-24 18:24 UTC", see `SearchIndexEntry`) back into epoch
 * milliseconds, for comparison against read-event timestamps
 * (REQ-EXPLORE-007). Returns `undefined` if the string can't be parsed, or
 * if `formatted` isn't a string at all — `modifiedAt` is omitted from a
 * `search-index.json` entry entirely when the note's last-modified date is
 * unknown (ADR-0015), so callers naturally skip those notes' staleness
 * check rather than crashing on `undefined.replace(...)`.
 * @param {unknown} formatted
 * @returns {number | undefined}
 */
export function parseModifiedAt(formatted) {
  if (typeof formatted !== "string") return undefined;
  const iso = formatted.replace(" UTC", "Z").replace(" ", "T");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

const EXPLORATION_CHANGED_EVENT = "enastro:exploration-changed";

/**
 * Reads the current log from localStorage and folds it as of `cursorTs`
 * (defaulting to "now"). Exposed for other client modules (e.g.
 * graph-view.mjs) that want the current status snapshot without wiring up
 * their own log-management logic.
 * @param {number} [cursorTs]
 * @returns {Map<string, string>}
 */
export function getStatusSnapshot(cursorTs) {
  return computeStatusAsOf(loadLog(), cursorTs);
}

function dispatchChanged(statusById, cursorTs) {
  window.dispatchEvent(new CustomEvent(EXPLORATION_CHANGED_EVENT, { detail: { statusById, cursorTs } }));
}

function formatEventTime(ts, offsetMinutes) {
  return formatLocalDateOnly(ts, offsetMinutes);
}

function main() {
  let log = loadLog();
  // `null` means "live" (cursor = now); any other value is an explicit
  // past timestamp the user rewound to (REQ-EXPLORE-003).
  let cursorTs = null;
  const offsetMinutes = -new Date().getTimezoneOffset();

  const bar = document.getElementById("exploration-bar");
  if (!bar) {
    // No shared header on this page (shouldn't happen for the three
    // generated page kinds, but keeps this module safe to load anywhere).
    return;
  }
  bar.hidden = false;

  const toggleButton = document.getElementById("exploration-rewind-toggle");
  const panel = document.getElementById("exploration-rewind-panel");
  const historyList = document.getElementById("exploration-history-list");
  const returnToNowButton = document.getElementById("exploration-return-to-now");
  const resetHereButton = document.getElementById("exploration-reset-here");
  const pruneHereButton = document.getElementById("exploration-prune-here");
  const warning = document.getElementById("exploration-storage-warning");
  const missingNotice = document.getElementById("exploration-missing-notice");
  const autoUnreadNotice = document.getElementById("exploration-auto-unread-notice");
  const markReadButton = document.querySelector("[data-mark-read]");
  const readAtSpan = document.querySelector("[data-read-at]");
  const readAtValue = readAtSpan?.querySelector("[data-read-value]");
  const readAtSep = document.querySelector("[data-read-sep]");

  function currentCursor() {
    return cursorTs ?? Infinity;
  }

  function showWarning(message) {
    if (!warning) return;
    warning.textContent = message;
    warning.hidden = false;
  }

  /** Persists `nextLog` directly (bypassing `appendEvent`), for the
   * destructive Reset/Prune operations which replace the whole log rather
   * than appending a single event. */
  function persistLog(nextLog) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLog));
      return true;
    } catch {
      return false;
    }
  }

  function renderHistoryList() {
    if (!historyList) return;
    historyList.replaceChildren();
    for (const event of [...log].reverse()) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${event.status === "read" ? "Read" : "Unread"} · ${event.id} · ${formatEventTime(event.ts, offsetMinutes)}`;
      // Highlight the entry currently being viewed via rewind (REQ-EXPLORE-003),
      // so it's obvious which point in history the page is showing. No entry
      // is highlighted while live (cursorTs === null): "now" isn't any single
      // logged event.
      const isActive = cursorTs !== null && event.ts === cursorTs;
      button.classList.toggle("active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "true");
      }
      button.addEventListener("click", () => {
        cursorTs = event.ts;
        update();
      });
      item.appendChild(button);
      historyList.appendChild(item);
    }

    // Synthetic entry for the "initial state" (before any event was ever
    // recorded, i.e. every note unread) — always shown at the very end of
    // the list (the oldest point in history), so it stays selectable even
    // once real events exist, and even when the log is empty.
    const initialItem = document.createElement("li");
    const initialButton = document.createElement("button");
    initialButton.type = "button";
    initialButton.textContent = "Initial state (nothing explored yet)";
    const isInitialActive = cursorTs === INITIAL_CURSOR_TS;
    initialButton.classList.toggle("active", isInitialActive);
    if (isInitialActive) {
      initialButton.setAttribute("aria-current", "true");
    }
    initialButton.addEventListener("click", () => {
      cursorTs = INITIAL_CURSOR_TS;
      update();
    });
    initialItem.appendChild(initialButton);
    historyList.appendChild(initialItem);
  }

  function applyToNoteList(statusById) {
    for (const item of document.querySelectorAll("#note-list li[data-id]")) {
      item.classList.toggle("explored", statusById.get(item.dataset.id) === "read");
    }
  }

  function applyToMarkReadButton(statusById) {
    if (!markReadButton) return;
    markReadButton.hidden = false;
    const id = markReadButton.dataset.markRead;
    const isRead = statusById.get(id) === "read";
    const label = isRead ? "Mark as unread" : "Mark as read";
    // The button is styled icon-only (site.css); the text content remains
    // as its accessible name, and `title` surfaces the same label as a
    // hover tooltip for sighted mouse users.
    markReadButton.textContent = label;
    markReadButton.title = label;
    markReadButton.setAttribute("aria-pressed", String(isRead));
    // Disabled while viewing a past state (REQ-EXPLORE-003): rewinding is
    // read-only, so it can't be mixed with recording new status changes.
    markReadButton.disabled = cursorTs !== null;

    // The read-at timestamp is the only other on-page indicator of
    // read/unread state on note pages, so its presence/absence doubles as
    // the at-a-glance read/unread cue (no separate button styling needed).
    if (readAtSpan) {
      const readAt = isRead ? getLastEventTimestamp(log, id, currentCursor()) : undefined;
      if (readAt !== undefined) {
        if (readAtValue) readAtValue.textContent = formatLocalDateOnly(readAt, offsetMinutes);
        readAtSpan.hidden = false;
        if (readAtSep) readAtSep.hidden = false;
      } else {
        readAtSpan.hidden = true;
        if (readAtSep) readAtSep.hidden = true;
      }
    }
  }

  function update() {
    const statusById = computeStatusAsOf(log, currentCursor());
    applyToNoteList(statusById);
    applyToMarkReadButton(statusById);
    if (returnToNowButton) {
      returnToNowButton.hidden = cursorTs === null;
    }
    if (resetHereButton) {
      resetHereButton.hidden = cursorTs === null;
    }
    if (pruneHereButton) {
      pruneHereButton.hidden = cursorTs === null;
    }
    renderHistoryList();
    dispatchChanged(statusById, currentCursor());
  }

  toggleButton?.addEventListener("click", () => {
    if (!panel) return;
    panel.hidden = !panel.hidden;
  });

  returnToNowButton?.addEventListener("click", () => {
    cursorTs = null;
    if (panel) panel.hidden = true;
    update();
  });

  resetHereButton?.addEventListener("click", () => {
    if (cursorTs === null) return;
    if (
      !confirm(
        "This will permanently delete all exploration history recorded after this point " +
          "(history up to and including this point is kept). Continue?",
      )
    ) {
      return;
    }
    log = resetLogAt(log, cursorTs);
    if (!persistLog(log)) {
      showWarning("Storage is full — this change was applied for now, but won't be saved after reload.");
    }
    cursorTs = null;
    if (panel) panel.hidden = true;
    update();
  });

  pruneHereButton?.addEventListener("click", () => {
    if (cursorTs === null) return;
    if (!confirm("This permanently removes no-op read/unread history up to this point. Continue?")) return;
    log = pruneLogUntil(log, cursorTs);
    if (!persistLog(log)) {
      showWarning("Storage is full — this change was applied for now, but won't be saved after reload.");
    }
    cursorTs = null;
    if (panel) panel.hidden = true;
    update();
  });

  warning?.addEventListener("click", () => {
    warning.hidden = true;
  });

  missingNotice?.addEventListener("click", () => {
    missingNotice.hidden = true;
  });

  autoUnreadNotice?.addEventListener("click", () => {
    autoUnreadNotice.hidden = true;
  });

  markReadButton?.addEventListener("click", () => {
    if (cursorTs !== null) return; // read-only while rewound
    const id = markReadButton.dataset.markRead;
    const statusById = computeStatusAsOf(log, currentCursor());
    const nextStatus = statusById.get(id) === "read" ? "unread" : "read";
    const result = appendEvent(log, id, nextStatus);
    log = result.log;
    if (!result.ok) {
      showWarning("Storage is full — this change was applied for now, but won't be saved after reload.");
    }
    update();
  });

  /**
   * Fetches the already-public search-index.json (id + modifiedAt for
   * every currently-published note) so that, on load, we can:
   *  - notice log entries whose id no longer corresponds to any published
   *    note (REQ-EXPLORE-006's topology-change resilience extended to a
   *    user-visible notice), and
   *  - auto-revert to "unread" any note marked "read" before its most
   *    recent edit (REQ-EXPLORE-007), since the reader's understanding of
   *    it may be stale.
   * Runs independently of the rest of this module: if it fails (offline,
   * missing file, bad JSON), the sync features are simply skipped and
   * every other exploration-status feature keeps working normally.
   */
  async function syncWithSearchIndex() {
    const href = bar.dataset.searchIndexHref;
    if (!href) return;

    let entries;
    try {
      const response = await fetch(href);
      if (!response.ok) return;
      entries = await response.json();
    } catch {
      return;
    }
    if (!Array.isArray(entries)) return;

    const modifiedAtById = new Map();
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string") continue;
      const epochMs = parseModifiedAt(entry.modifiedAt);
      if (epochMs !== undefined) modifiedAtById.set(entry.id, epochMs);
    }
    if (modifiedAtById.size === 0) return;

    // Each notice is independently shown/dismissed, and lists the actual
    // note ids (rather than just a count) since the box is dismissed with
    // a single click anyway — the id is more useful than a bare number.
    const loggedIds = new Set(log.map((event) => event.id));
    const missingIds = [...loggedIds].filter((id) => !modifiedAtById.has(id));
    if (missingIds.length > 0 && missingNotice) {
      missingNotice.textContent = `No longer exist, can no longer be tracked: ${missingIds.join(", ")}`;
      missingNotice.hidden = false;
    }

    const autoUnreadIds = [];
    const statusById = computeStatusAsOf(log, Infinity);
    for (const [id, status] of statusById) {
      if (status !== "read") continue;
      const modifiedAtMs = modifiedAtById.get(id);
      if (modifiedAtMs === undefined) continue;
      const readTs = getLastEventTimestamp(log, id, Infinity);
      if (readTs !== undefined && modifiedAtMs > readTs) {
        const result = appendEvent(log, id, "unread");
        log = result.log;
        autoUnreadIds.push(id);
      }
    }
    if (autoUnreadIds.length > 0 && autoUnreadNotice) {
      autoUnreadNotice.textContent = `Updated since read, marked unread again: ${autoUnreadIds.join(", ")}`;
      autoUnreadNotice.hidden = false;
    }

    if (autoUnreadIds.length > 0) {
      update();
    }
  }

  update();
  void syncWithSearchIndex();
}

// Guarded so this module can be imported for its pure log/status functions
// from a plain Node test environment (no `document` global) without
// triggering the DOM-wiring side effects below.
if (typeof document !== "undefined") {
  main();
}
