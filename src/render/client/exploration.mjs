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
 */

export const STORAGE_KEY = "enastro:exploration:v1";

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

function formatEventTime(ts) {
  return new Date(ts).toLocaleString();
}

function main() {
  let log = loadLog();
  // `null` means "live" (cursor = now); any other value is an explicit
  // past timestamp the user rewound to (REQ-EXPLORE-003).
  let cursorTs = null;

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
  const warning = document.getElementById("exploration-storage-warning");
  const markReadButton = document.querySelector("[data-mark-read]");

  function currentCursor() {
    return cursorTs ?? Infinity;
  }

  function showWarning(message) {
    if (!warning) return;
    warning.textContent = message;
    warning.hidden = false;
  }

  function renderHistoryList() {
    if (!historyList) return;
    historyList.replaceChildren();
    for (const event of [...log].reverse()) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${event.status === "read" ? "Read" : "Unread"} · ${event.id} · ${formatEventTime(event.ts)}`;
      button.addEventListener("click", () => {
        cursorTs = event.ts;
        update();
      });
      item.appendChild(button);
      historyList.appendChild(item);
    }
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
    markReadButton.textContent = isRead ? "Mark as unread" : "Mark as read";
    markReadButton.setAttribute("aria-pressed", String(isRead));
    // Disabled while viewing a past state (REQ-EXPLORE-003): rewinding is
    // read-only, so it can't be mixed with recording new status changes.
    markReadButton.disabled = cursorTs !== null;
  }

  function update() {
    const statusById = computeStatusAsOf(log, currentCursor());
    applyToNoteList(statusById);
    applyToMarkReadButton(statusById);
    if (returnToNowButton) {
      returnToNowButton.hidden = cursorTs === null;
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
    update();
  });

  warning?.addEventListener("click", () => {
    warning.hidden = true;
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

  update();
}

// Guarded so this module can be imported for its pure log/status functions
// from a plain Node test environment (no `document` global) without
// triggering the DOM-wiring side effects below.
if (typeof document !== "undefined") {
  main();
}
