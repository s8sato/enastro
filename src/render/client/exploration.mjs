/**
 * Client-side "exploration status" (REQ-EXPLORE-001~005): tracks per-note
 * read/unread state entirely in the browser's localStorage. This state is
 * never written to any build artifact (graph.json, search-index.json,
 * generated HTML) — see spec/08-security-and-privacy.md's privacy
 * invariant, which this feature must not violate. Runs directly in the
 * browser as an ES module; no bundler/build step needed.
 *
 * Data model: an append-only event log, `{id, status, ts}[]`, plus a
 * persisted "Snapshot" base map (`id -> status`), together stored under
 * STORAGE_KEY as `{snapshot, log}` (ADR-0014, "Snapshot 概念の導入"). The
 * *current* status of a note is derived by starting from the Snapshot and
 * folding the log up to a given point in time (a "cursor") on top of it:
 * later events for the same id override earlier ones (and the Snapshot).
 * This is what lets the rewind UI show the list/graph as it looked at any
 * past moment without ever deleting history (REQ-EXPLORE-003).
 *
 * Status is keyed purely by note id, so it survives graph topology changes
 * (added/removed nodes or edges) unaffected (REQ-EXPLORE-004): ids no
 * longer present are simply never looked up by the index/graph pages, and
 * new ids default to "unread".
 *
 * The rewind cursor position and the History drawer's open/closed state
 * *are* persisted across page loads (ADR-0014, "カーソル位置のブラウザ永続化" —
 * this supersedes that ADR's earlier "非永続" decision), under their own
 * `localStorage` keys (`CURSOR_STORAGE_KEY`/`DRAWER_STORAGE_KEY`), separate
 * from `STORAGE_KEY` since they are UI/view state, not exploration history
 * data — a failed write to either does NOT trigger the storage-full
 * warning banner (REQ-EXPLORE-002), unlike a failed write to `STORAGE_KEY`.
 * The cursor is always exactly one of three states: "now" (live, the
 * default), the Snapshot, or a specific past event timestamp — see
 * `loadCursor()`/`saveCursor()`.
 *
 * Two operations *do* permanently rewrite persisted state, as an explicit,
 * user-confirmed exception to the above (ADR-0014, "Reset to here" /
 * "Squash until here"): `resetLogAt()` actually reverts to the rewound
 * state by discarding every event *after* the cursor (like `git reset
 * --hard`), and `squashStateUntil()` folds every event up to the cursor
 * into the Snapshot and removes them from the log (net effect preserved,
 * history compacted). Both are pure functions; the DOM-wiring code below
 * is responsible for persisting their result and requires an explicit
 * confirmation before doing so.
 *
 * The Snapshot also carries a `snapshotUpdatedAt` timestamp (ADR-0014,
 * "Snapshot 更新時刻表示"), displayed on its History row. It is set eagerly
 * — the first time `loadState()` has to fall back to a fresh state (no
 * persisted key yet, a corrupt v2 entry, or a legacy v1-only migration) —
 * to `Date.now()`, and that fresh state is immediately persisted so the
 * timestamp is fixed at first load and stable across reloads (it is NOT
 * regenerated on every load of an already-valid state). `squashStateUntil()`
 * refreshes it to the real time the Squash was executed. `resetLogAt()`
 * (used by "Reset to here") never touches the Snapshot at all, so it
 * leaves `snapshotUpdatedAt` untouched.
 */
import { formatLocalDateOnly } from "./format-local-time.mjs";

export const STORAGE_KEY = "enastro:exploration:v2";

/** Legacy (pre-Snapshot) storage key: a bare event-log array, no Snapshot. */
const LEGACY_STORAGE_KEY = "enastro:exploration:v1";

/**
 * `localStorage` key for the persisted rewind cursor position (ADR-0014,
 * "カーソル位置のブラウザ永続化"). Kept separate from `STORAGE_KEY` since this
 * is view-only UI state, not exploration history data.
 */
export const CURSOR_STORAGE_KEY = "enastro:exploration:cursor:v1";

/**
 * `localStorage` key for the persisted History drawer open/closed state
 * (ADR-0014, "カーソル位置のブラウザ永続化").
 */
export const DRAWER_STORAGE_KEY = "enastro:exploration:drawer:v1";

/**
 * Sentinel cursor value representing "the Snapshot" — the persisted base
 * state before any log event still on record. Folding the log up to this
 * cursor (`computeStatusAsOf(state, SNAPSHOT_CURSOR_TS)`) naturally yields
 * the Snapshot's own content unmodified, since every real event's `ts` is a
 * `Date.now()` value and therefore always greater than `-Infinity`. This
 * lets the Snapshot be selected from the History list exactly like any
 * other rewind target, without any special-casing in the pure
 * state/status functions below.
 */
export const SNAPSHOT_CURSOR_TS = Number.NEGATIVE_INFINITY;

/**
 * Reads the persisted `{snapshot, log, snapshotUpdatedAt}` state from
 * localStorage. Transparently migrates a legacy `v1` bare event-log array
 * (if present, and no `v2` state exists yet) into
 * `{snapshot: {}, log: legacyLog}` — the old key is left in place (harmless
 * orphan) rather than actively deleted. Whenever no valid `v2` state can be
 * found (absent, corrupt, or only a legacy migration), a fresh state is
 * built with `snapshotUpdatedAt: Date.now()` and immediately persisted via
 * `saveState()` — this fixes the Snapshot's "updated at" timestamp at
 * first-load time, so it stays stable across subsequent reloads rather
 * than being recomputed every time. A valid existing `v2` state is
 * returned as-is, its `snapshotUpdatedAt` left untouched.
 * @returns {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[], snapshotUpdatedAt: number}}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.log) &&
        typeof parsed.snapshotUpdatedAt === "number"
      ) {
        const snapshot = parsed.snapshot && typeof parsed.snapshot === "object" ? parsed.snapshot : {};
        return { snapshot, log: parsed.log, snapshotUpdatedAt: parsed.snapshotUpdatedAt };
      }
    }
  } catch {
    // fall through to legacy migration / fresh state
  }
  let freshLog = [];
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        freshLog = legacyParsed;
      }
    }
  } catch {
    // fall through to empty log
  }
  const freshState = { snapshot: {}, log: freshLog, snapshotUpdatedAt: Date.now() };
  saveState(freshState);
  return freshState;
}

/**
 * Persists a `{snapshot, log, snapshotUpdatedAt}` state object to
 * localStorage.
 * @param {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[], snapshotUpdatedAt: number}} state
 * @returns {boolean} whether the write succeeded.
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends a new `{id, status, ts}` event to `state.log` and attempts to
 * persist the updated state to localStorage. `state.snapshot` passes
 * through unchanged.
 * @param {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[]}} state
 * @param {string} id
 * @param {string} status
 * @returns {{state: {snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[]}, ok: boolean, error?: unknown}}
 *   the updated (in-memory) state, and whether the write to localStorage
 *   succeeded. On failure (e.g. a QuotaExceededError), the event is still
 *   included in the returned `state` so the current page can reflect it
 *   immediately, but it will not survive a reload (REQ-EXPLORE-002).
 */
export function appendEvent(state, id, status) {
  const nextState = {
    snapshot: state.snapshot,
    log: [...state.log, { id, status, ts: Date.now() }],
    snapshotUpdatedAt: state.snapshotUpdatedAt,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return { state: nextState, ok: true };
  } catch (error) {
    return { state: nextState, ok: false, error };
  }
}

/**
 * Folds `state.snapshot` plus `state.log` up to (and including) `cursorTs`
 * into a Map of id -> status: the Snapshot seeds the result, then log
 * events (assumed already in chronological order, as produced by
 * `appendEvent`) with a later `ts` than `cursorTs` are ignored, and any
 * remaining ones override the Snapshot's entry for the same id — which is
 * what makes rewinding possible.
 * @param {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[]}} state
 * @param {number} [cursorTs] defaults to Infinity (i.e. "now"/live).
 * @returns {Map<string, string>}
 */
export function computeStatusAsOf(state, cursorTs = Infinity) {
  const statusById = new Map(Object.entries(state.snapshot));
  for (const event of state.log) {
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
 * "Squash until here" (ADR-0014): folds every event in the range
 * `(-∞, cursorTs]` into the Snapshot — computing the resulting id->status
 * map as of `cursorTs` (which already accounts for the existing Snapshot,
 * see `computeStatusAsOf()`) and replacing `state.snapshot` with it — then
 * removes all of those events from the log (`event.ts > cursorTs` is kept
 * untouched). Net status is preserved; only the individual events up to
 * the cursor are compacted away. Also a one-way, destructive rewrite; see
 * `resetLogAt()`'s doc comment for the same caveat. Also refreshes
 * `snapshotUpdatedAt` to the real time this Squash was executed
 * (`Date.now()`), reflecting that the Snapshot's content actually changed
 * just now.
 * @param {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[], snapshotUpdatedAt: number}} state
 * @param {number} cursorTs
 * @returns {{snapshot: Record<string, string>, log: {id: string, status: string, ts: number}[], snapshotUpdatedAt: number}}
 */
export function squashStateUntil(state, cursorTs) {
  const folded = computeStatusAsOf(state, cursorTs);
  return {
    snapshot: Object.fromEntries(folded),
    log: state.log.filter((event) => event.ts > cursorTs),
    snapshotUpdatedAt: Date.now(),
  };
}

/**
 * Returns whether `ts` refers to "now" as defined by the event log: the
 * timestamp of the log's most recent (last) event, since there is by
 * definition no event after it. `state.log` is always kept in ascending
 * `ts` order (append-only via `appendEvent()`, and `resetLogAt()`/
 * `squashStateUntil()` only filter, never reorder), so the most recent
 * event is simply the last array element. Used to normalize a candidate
 * rewind cursor (e.g. from clicking a History row) so that selecting the
 * newest logged event is treated identically to being live/"now" — rather
 * than as a distinct "rewound to a point that happens to equal now" state
 * (REQ-EXPLORE-009, ADR-0014). Returns `false` for an empty log (there is
 * no "most recent event" to match against).
 * @param {{ts: number}[]} log
 * @param {number} ts
 * @returns {boolean}
 */
export function isNowTs(log, ts) {
  return log.length > 0 && log[log.length - 1].ts === ts;
}

/**
 * Reads the persisted rewind cursor position (ADR-0014, "カーソル位置の
 * ブラウザ永続化"). The cursor is always exactly one of three states —
 * "now" (live, `null`), the Snapshot (`SNAPSHOT_CURSOR_TS`), or a specific
 * past event timestamp — tagged as `{mode: "now"} | {mode: "snapshot"} |
 * {mode: "past", ts: number}` in storage, since plain `JSON.stringify`
 * can't round-trip `SNAPSHOT_CURSOR_TS` (`-Infinity` serializes to `null`).
 * Falls back to `null` ("now") on any absent/corrupt data.
 * @returns {number | null}
 */
export function loadCursor() {
  try {
    const raw = localStorage.getItem(CURSOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.mode === "snapshot") return SNAPSHOT_CURSOR_TS;
    if (parsed && parsed.mode === "past" && typeof parsed.ts === "number") return parsed.ts;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists the rewind cursor position. See `loadCursor()` for the storage
 * shape. A failed write (e.g. `QuotaExceededError`) is swallowed — unlike
 * `saveState()`, callers must NOT surface the storage-full warning banner
 * for this, since this is UI/view state, not exploration history data
 * (REQ-EXPLORE-002 only applies to the latter).
 * @param {number | null} cursorTs
 * @returns {boolean} whether the write succeeded.
 */
export function saveCursor(cursorTs) {
  const payload =
    cursorTs === null ? { mode: "now" } : cursorTs === SNAPSHOT_CURSOR_TS ? { mode: "snapshot" } : { mode: "past", ts: cursorTs };
  try {
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the persisted History drawer open/closed state (ADR-0014,
 * "カーソル位置のブラウザ永続化"). Falls back to `false` (closed) on any
 * absent/corrupt data.
 * @returns {boolean}
 */
export function loadDrawerOpen() {
  try {
    return localStorage.getItem(DRAWER_STORAGE_KEY) === "open";
  } catch {
    return false;
  }
}

/**
 * Persists the History drawer open/closed state. See `loadCursor()`'s doc
 * comment for why write failures here are swallowed rather than surfaced
 * as a storage-full warning.
 * @param {boolean} open
 * @returns {boolean} whether the write succeeded.
 */
export function saveDrawerOpen(open) {
  try {
    localStorage.setItem(DRAWER_STORAGE_KEY, open ? "open" : "closed");
    return true;
  } catch {
    return false;
  }
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
  return computeStatusAsOf(loadState(), cursorTs);
}

function dispatchChanged(statusById, cursorTs) {
  window.dispatchEvent(new CustomEvent(EXPLORATION_CHANGED_EVENT, { detail: { statusById, cursorTs } }));
}

function formatEventTime(ts, offsetMinutes) {
  return formatLocalDateOnly(ts, offsetMinutes);
}

function main() {
  let state = loadState();
  // `null` means "live" (cursor = now); `SNAPSHOT_CURSOR_TS` means the
  // Snapshot; any other value is an explicit past event timestamp the user
  // rewound to (REQ-EXPLORE-003). Restored from `localStorage` so it
  // survives page navigation/reload (REQ-EXPLORE-009, ADR-0014).
  let cursorTs = loadCursor();
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
  const scrim = document.getElementById("exploration-drawer-scrim");
  const closeButton = document.getElementById("exploration-drawer-close");
  const historyList = document.getElementById("exploration-history-list");
  const returnToNowButton = document.getElementById("exploration-return-to-now");
  const resetHereButton = document.getElementById("exploration-reset-here");
  const squashHereButton = document.getElementById("exploration-squash-here");
  const warning = document.getElementById("exploration-storage-warning");
  const missingNotice = document.getElementById("exploration-missing-notice");
  const autoUnreadNotice = document.getElementById("exploration-auto-unread-notice");
  const markReadButton = document.querySelector("[data-mark-read]");
  const readAtSpan = document.querySelector("[data-read-at]");
  const readAtValue = readAtSpan?.querySelector("[data-read-value]");
  const readAtSep = document.querySelector("[data-read-sep]");

  if (toggleButton) toggleButton.hidden = false;

  function currentCursor() {
    return cursorTs ?? Infinity;
  }

  function showWarning(message) {
    if (!warning) return;
    const textEl = warning.querySelector("[data-text]");
    if (textEl) textEl.textContent = message;
    warning.hidden = false;
  }

  /**
   * Keeps the drawer/scrim positioned *below* the `<nav>` bar (REQ-UX /
   * history-drawer mock) rather than covering it. Measured at runtime
   * (rather than hardcoding a value) since `<nav>` can wrap onto multiple
   * lines on narrow viewports — the same approach graph-view.mjs uses for
   * `#particle-direction-toggle`. Deliberately always `<nav>` itself, on
   * every page kind: the graph page's `.graph-header` wrapper also
   * includes a `#tag-filters` row, but that row scrolls away (not
   * `position: sticky`) on the All Notes page, so using it as the
   * position basis there would push the drawer below content that isn't
   * actually pinned — using bare `<nav>` uniformly keeps the graph page's
   * drawer position aligned with the All Notes/note pages instead of
   * sitting lower to also clear the (graph-only-pinned) tag-filters row.
   * `Math.round()` avoids sub-pixel gaps/overlaps between `<nav>`'s
   * measured bottom edge and the drawer/scrim's `top`.
   */
  function syncDrawerPosition() {
    const header = document.querySelector("nav");
    if (!header) return;
    const top = `${Math.round(header.getBoundingClientRect().bottom)}px`;
    if (panel) panel.style.top = top;
    if (scrim) scrim.style.top = top;
  }

  const headerEl = document.querySelector("nav");
  if (headerEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncDrawerPosition).observe(headerEl);
  }
  window.addEventListener("resize", syncDrawerPosition);
  syncDrawerPosition();

  function openDrawer(animate = true) {
    if (!panel) return;
    syncDrawerPosition();
    panel.hidden = false;
    if (scrim) scrim.hidden = false;
    saveDrawerOpen(true);
    if (animate) {
      // Applied on the next frame so the initial (off-screen) state paints
      // first, letting the `transform`/`opacity` transitions to `.open`
      // actually animate instead of jumping straight to the open state.
      requestAnimationFrame(() => {
        panel.classList.add("open");
        scrim?.classList.add("open");
      });
      closeButton?.focus({ preventScroll: true });
    } else {
      // Restoring a persisted "open" state on page load: skip the
      // slide-in transition entirely so it doesn't replay on every
      // navigation (ADR-0014, "カーソル位置のブラウザ永続化").
      panel.classList.add("open");
      scrim?.classList.add("open");
    }
  }

  function closeDrawer() {
    if (!panel || panel.hidden) return;
    saveDrawerOpen(false);
    panel.classList.remove("open");
    scrim?.classList.remove("open");
    const finish = () => {
      panel.hidden = true;
      if (scrim) scrim.hidden = true;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
    } else {
      panel.addEventListener("transitionend", finish, { once: true });
    }
    toggleButton?.focus({ preventScroll: true });
  }

  function isDrawerOpen() {
    return !!panel && !panel.hidden;
  }

  /** Persists `nextState` directly (bypassing `appendEvent`), for the
   * destructive Reset/Squash operations which replace the whole state
   * rather than appending a single event. */
  function persistState(nextState) {
    return saveState(nextState);
  }

  /**
   * Builds one history-list row's markup: a leading verb icon (Read =
   * muted eye, Unread = nebula-colored dot, Snapshot = accent-dim
   * star — REQ-UX / history-drawer mock), the verb label, and — for real
   * events only — the note id (ellipsized via CSS if too long) and a
   * right-aligned timestamp. Monospace is reserved for the id/timestamp;
   * everything else uses the default sans font (site.css).
   */
  function buildHistoryRow(kind, verbText, subjectText, timeText) {
    const verbIcon = document.createElement("span");
    verbIcon.className = `verb-icon is-${kind}`;
    verbIcon.setAttribute("aria-hidden", "true");

    const verb = document.createElement("span");
    verb.className = "verb";
    verb.textContent = verbText;

    const fragment = document.createDocumentFragment();
    fragment.append(verbIcon, verb);

    if (subjectText !== undefined) {
      const subject = document.createElement("span");
      subject.className = "subject";
      subject.textContent = subjectText;
      fragment.append(subject);
    }
    if (timeText !== undefined) {
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = timeText;
      fragment.append(time);
    }
    return fragment;
  }

  function renderHistoryList() {
    if (!historyList) return;
    historyList.replaceChildren();
    for (const event of [...state.log].reverse()) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const kind = event.status === "read" ? "read" : "unread";
      button.append(
        buildHistoryRow(
          kind,
          event.status === "read" ? "Read" : "Unread",
          event.id,
          formatEventTime(event.ts, offsetMinutes),
        ),
      );
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
        // "now" is defined as the log's most recent event (REQ-EXPLORE-009,
        // ADR-0014): selecting that entry is treated identically to
        // returning to live, not as a distinct rewound state.
        cursorTs = isNowTs(state.log, event.ts) ? null : event.ts;
        saveCursor(cursorTs);
        update();
      });
      item.appendChild(button);
      historyList.appendChild(item);
    }

    // Synthetic entry for the Snapshot (the persisted base state before any
    // remaining log event) — always shown at the very end of the list (the
    // oldest point in history), so it stays selectable even once real
    // events exist, and even when the log is empty.
    const snapshotItem = document.createElement("li");
    const snapshotButton = document.createElement("button");
    snapshotButton.type = "button";
    snapshotButton.append(
      buildHistoryRow("snapshot", "Snapshot", undefined, formatEventTime(state.snapshotUpdatedAt, offsetMinutes)),
    );
    const isSnapshotActive = cursorTs === SNAPSHOT_CURSOR_TS;
    snapshotButton.classList.toggle("active", isSnapshotActive);
    if (isSnapshotActive) {
      snapshotButton.setAttribute("aria-current", "true");
    }
    snapshotButton.addEventListener("click", () => {
      cursorTs = SNAPSHOT_CURSOR_TS;
      saveCursor(cursorTs);
      update();
    });
    snapshotItem.appendChild(snapshotButton);
    historyList.appendChild(snapshotItem);
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
      const readAt = isRead ? getLastEventTimestamp(state.log, id, currentCursor()) : undefined;
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
    const statusById = computeStatusAsOf(state, currentCursor());
    applyToNoteList(statusById);
    applyToMarkReadButton(statusById);
    // Button enablement (REQ-EXPLORE-009, ADR-0014): Return/Reset act on an
    // actual rewound cursor, so they're disabled while already at "now".
    // Squash folds everything up to the cursor into the Snapshot, so it's
    // only meaningless (and disabled) once the cursor already *is* the
    // Snapshot — it stays enabled at "now" (folding the whole log) and at
    // any past event.
    if (returnToNowButton) {
      returnToNowButton.disabled = cursorTs === null;
    }
    if (resetHereButton) {
      resetHereButton.disabled = cursorTs === null;
    }
    if (squashHereButton) {
      squashHereButton.disabled = cursorTs === SNAPSHOT_CURSOR_TS;
    }
    renderHistoryList();
    dispatchChanged(statusById, currentCursor());
  }

  toggleButton?.addEventListener("click", () => {
    if (isDrawerOpen()) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  closeButton?.addEventListener("click", () => {
    closeDrawer();
  });

  scrim?.addEventListener("click", () => {
    closeDrawer();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isDrawerOpen()) {
      closeDrawer();
    }
  });

  returnToNowButton?.addEventListener("click", () => {
    if (cursorTs === null) return;
    cursorTs = null;
    saveCursor(cursorTs);
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
    state = {
      snapshot: state.snapshot,
      log: resetLogAt(state.log, cursorTs),
      snapshotUpdatedAt: state.snapshotUpdatedAt,
    };
    if (!persistState(state)) {
      showWarning("Storage is full — this change was applied for now, but won't be saved after reload.");
    }
    // "Reset to here" lands the cursor on the new "now" (REQ-EXPLORE-009):
    // the rewound-to state has just become the live state.
    cursorTs = null;
    saveCursor(cursorTs);
    update();
  });

  squashHereButton?.addEventListener("click", () => {
    if (cursorTs === SNAPSHOT_CURSOR_TS) return;
    if (
      !confirm(
        "This folds all read/unread history up to this point into the Snapshot, permanently " +
          "removing the individual events (their net effect is preserved). Continue?",
      )
    ) {
      return;
    }
    // Folds up to the current cursor — including "now" (`currentCursor()`
    // resolves `null` to `Infinity`), which is now a valid target since
    // Squash is enabled while live (REQ-EXPLORE-009).
    state = squashStateUntil(state, currentCursor());
    if (!persistState(state)) {
      showWarning("Storage is full — this change was applied for now, but won't be saved after reload.");
    }
    // "Squash until here" folds everything up to the cursor into the
    // Snapshot, so the cursor now lands on that new Snapshot rather than
    // returning to "now" (REQ-EXPLORE-009, ADR-0014 amendment).
    cursorTs = SNAPSHOT_CURSOR_TS;
    saveCursor(cursorTs);
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
    const statusById = computeStatusAsOf(state, currentCursor());
    const nextStatus = statusById.get(id) === "read" ? "unread" : "read";
    const result = appendEvent(state, id, nextStatus);
    state = result.state;
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
    const loggedIds = new Set(state.log.map((event) => event.id));
    const missingIds = [...loggedIds].filter((id) => !modifiedAtById.has(id));
    if (missingIds.length > 0 && missingNotice) {
      const textEl = missingNotice.querySelector("[data-text]");
      if (textEl) textEl.textContent = `No longer exist, can no longer be tracked: ${missingIds.join(", ")}`;
      missingNotice.hidden = false;
    }

    const autoUnreadIds = [];
    const statusById = computeStatusAsOf(state, Infinity);
    for (const [id, status] of statusById) {
      if (status !== "read") continue;
      const modifiedAtMs = modifiedAtById.get(id);
      if (modifiedAtMs === undefined) continue;
      const readTs = getLastEventTimestamp(state.log, id, Infinity);
      if (readTs !== undefined && modifiedAtMs > readTs) {
        const result = appendEvent(state, id, "unread");
        state = result.state;
        autoUnreadIds.push(id);
      }
    }
    if (autoUnreadIds.length > 0 && autoUnreadNotice) {
      const textEl = autoUnreadNotice.querySelector("[data-text]");
      if (textEl) textEl.textContent = `Updated since read, marked unread again: ${autoUnreadIds.join(", ")}`;
      autoUnreadNotice.hidden = false;
    }

    if (autoUnreadIds.length > 0) {
      update();
    }
  }

  // Restore a persisted "open" drawer state without the slide-in
  // transition (REQ-EXPLORE-009, ADR-0014 amendment) — only user-initiated
  // opens (toggle button) animate.
  if (loadDrawerOpen()) {
    openDrawer(false);
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
