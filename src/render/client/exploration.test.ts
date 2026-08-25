import { beforeEach, describe, expect, it } from "vitest";
import {
  CURSOR_STORAGE_KEY,
  DRAWER_STORAGE_KEY,
  SNAPSHOT_CURSOR_TS,
  STORAGE_KEY,
  appendEvent,
  computeStatusAsOf,
  getLastEventTimestamp,
  loadCursor,
  loadDrawerOpen,
  loadState,
  parseModifiedAt,
  resetLogAt,
  saveCursor,
  saveDrawerOpen,
  squashStateUntil,
} from "./exploration.mjs";

/** Legacy (pre-Snapshot) storage key, mirrored here for migration tests. */
const LEGACY_STORAGE_KEY = "enastro:exploration:v1";

/** Shorthand for building a `{snapshot, log, snapshotUpdatedAt}` state in tests. */
function state(
  log: { id: string; status: string; ts: number }[],
  snapshot: Record<string, string> = {},
  snapshotUpdatedAt = 0,
) {
  return { snapshot, log, snapshotUpdatedAt };
}

/**
 * Minimal in-memory localStorage mock (vitest's default environment is
 * plain Node, which has no `localStorage` global). Kept intentionally
 * small — just enough to exercise `loadState`/`appendEvent`'s persistence
 * behavior, including a way to simulate quota-exceeded failures.
 */
class MemoryStorage implements Storage {
  #store = new Map<string, string>();
  #shouldThrowOnSetItem = false;

  get length(): number {
    return this.#store.size;
  }

  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#store.has(key) ? (this.#store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    if (this.#shouldThrowOnSetItem) {
      const error = new Error("Quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.#store.set(key, value);
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }

  simulateQuotaExceeded(): void {
    this.#shouldThrowOnSetItem = true;
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe("loadState (REQ-EXPLORE-001)", () => {
  it("returns a fresh empty snapshot/log with a snapshotUpdatedAt when nothing has been stored yet", () => {
    const before = Date.now();
    const loaded = loadState();
    expect(loaded.snapshot).toEqual({});
    expect(loaded.log).toEqual([]);
    expect(loaded.snapshotUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(loaded.snapshotUpdatedAt).toBeLessThanOrEqual(Date.now());
  });

  it("eagerly persists the fresh state so snapshotUpdatedAt is stable across reloads", () => {
    const first = loadState();
    const second = loadState();
    expect(second).toEqual(first);
  });

  it("returns a fresh state rather than throwing when the stored value is corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    const loaded = loadState();
    expect(loaded.snapshot).toEqual({});
    expect(loaded.log).toEqual([]);
    expect(typeof loaded.snapshotUpdatedAt).toBe("number");
  });

  it("returns a fresh state rather than throwing when the stored value has no log array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "a state" }));
    const loaded = loadState();
    expect(loaded.snapshot).toEqual({});
    expect(loaded.log).toEqual([]);
    expect(typeof loaded.snapshotUpdatedAt).toBe("number");
  });

  it("treats a v2-shaped state missing snapshotUpdatedAt as invalid and re-initializes it", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapshot: { "note-a": "read" }, log: [] }));
    const loaded = loadState();
    // The pre-Snapshot-timestamp shape is treated as corrupt/legacy-less data:
    // it's safer to reinitialize than to guess a fake `snapshotUpdatedAt`.
    expect(loaded.snapshot).toEqual({});
    expect(loaded.log).toEqual([]);
    expect(typeof loaded.snapshotUpdatedAt).toBe("number");
  });

  it("migrates a legacy v1 bare event-log array into {snapshot: {}, log, snapshotUpdatedAt}", () => {
    const legacyLog = [{ id: "note-a", status: "read", ts: 100 }];
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyLog));
    const loaded = loadState();
    expect(loaded.snapshot).toEqual({});
    expect(loaded.log).toEqual(legacyLog);
    expect(typeof loaded.snapshotUpdatedAt).toBe("number");
  });

  it("prefers the v2 {snapshot, log, snapshotUpdatedAt} state over a stale legacy v1 array", () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([{ id: "note-z", status: "read", ts: 1 }]));
    const v2State = { snapshot: { "note-a": "read" }, log: [], snapshotUpdatedAt: 12345 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2State));
    expect(loadState()).toEqual(v2State);
  });
});

describe("appendEvent (REQ-EXPLORE-001, REQ-EXPLORE-002)", () => {
  it("persists the new event (snapshot passed through) and returns ok: true on success", () => {
    const { state: next, ok } = appendEvent(state([], { "note-z": "read" }), "note-a", "read");
    expect(ok).toBe(true);
    expect(next.snapshot).toEqual({ "note-z": "read" });
    expect(next.log).toHaveLength(1);
    expect(next.log[0]).toMatchObject({ id: "note-a", status: "read" });
    expect(loadState()).toEqual(next);
  });

  it("still returns the appended event in-memory (but ok: false) when storage is full", () => {
    localStorage.simulateQuotaExceeded();
    const { state: next, ok, error } = appendEvent(state([]), "note-a", "read");
    expect(ok).toBe(false);
    expect(error).toBeInstanceOf(Error);
    expect(next.log).toHaveLength(1);
    // The failed write must not have silently succeeded: nothing was ever
    // persisted, so a fresh load starts over (also failing to persist, since
    // storage is still full, but still returned in-memory).
    const reloaded = loadState();
    expect(reloaded.snapshot).toEqual({});
    expect(reloaded.log).toEqual([]);
  });
});

describe("computeStatusAsOf (REQ-EXPLORE-001, REQ-EXPLORE-003)", () => {
  const log = [
    { id: "note-a", status: "read", ts: 100 },
    { id: "note-b", status: "read", ts: 200 },
    { id: "note-a", status: "unread", ts: 300 },
  ];

  it("defaults to folding the entire log (live/'now' view)", () => {
    const status = computeStatusAsOf(state(log));
    expect(status.get("note-a")).toBe("unread");
    expect(status.get("note-b")).toBe("read");
  });

  it("ignores events after the given cursor, enabling rewind", () => {
    const status = computeStatusAsOf(state(log), 150);
    expect(status.get("note-a")).toBe("read");
    expect(status.has("note-b")).toBe(false);
  });

  it("is unaffected by ids that no longer exist in the current graph (topology-change resilience)", () => {
    const status = computeStatusAsOf(state(log));
    // A deleted note's id simply remains an ordinary (harmless) map entry;
    // callers only ever look up ids that are still present in graph.json /
    // the note list, so stale ids never surface anywhere.
    expect(status.get("deleted-note")).toBeUndefined();
  });

  it("returns 'unread' semantics (absence) for notes with no events at all", () => {
    const status = computeStatusAsOf(state(log));
    expect(status.has("note-c")).toBe(false);
  });

  it("seeds the result from the Snapshot, then layers the log on top", () => {
    const snapshot = { "note-a": "read", "note-c": "read" };
    const status = computeStatusAsOf(state(log, snapshot));
    expect(status.get("note-a")).toBe("unread"); // log's later event wins
    expect(status.get("note-b")).toBe("read"); // from log only
    expect(status.get("note-c")).toBe("read"); // from snapshot only
  });

  it("returns exactly the Snapshot's content when cursor is SNAPSHOT_CURSOR_TS (no log folding)", () => {
    const snapshot = { "note-a": "read" };
    const status = computeStatusAsOf(state(log, snapshot), SNAPSHOT_CURSOR_TS);
    expect(status).toEqual(new Map(Object.entries(snapshot)));
  });
});

describe("getLastEventTimestamp (read-at display, REQ-EXPLORE-007)", () => {
  const log = [
    { id: "note-a", status: "read", ts: 100 },
    { id: "note-b", status: "read", ts: 200 },
    { id: "note-a", status: "unread", ts: 300 },
    { id: "note-a", status: "read", ts: 400 },
  ];

  it("returns the ts of the most recent event for the given id", () => {
    expect(getLastEventTimestamp(log, "note-a")).toBe(400);
  });

  it("respects a cursor, ignoring later events", () => {
    expect(getLastEventTimestamp(log, "note-a", 300)).toBe(300);
    expect(getLastEventTimestamp(log, "note-a", 150)).toBe(100);
  });

  it("returns undefined for an id with no events", () => {
    expect(getLastEventTimestamp(log, "note-z")).toBeUndefined();
  });
});

describe("resetLogAt (Reset to here, ADR-0014)", () => {
  const log = [
    { id: "note-a", status: "read", ts: 100 },
    { id: "note-b", status: "read", ts: 200 },
    { id: "note-a", status: "unread", ts: 300 },
    { id: "note-a", status: "read", ts: 500 },
  ];

  it("keeps all events at/before the cursor completely untouched (no collapsing/aggregation)", () => {
    const reset = resetLogAt(log, 300);
    expect(reset.filter((e) => e.ts <= 300)).toEqual(log.filter((e) => e.ts <= 300));
  });

  it("permanently discards events strictly after the cursor", () => {
    const reset = resetLogAt(log, 300);
    expect(reset).not.toContainEqual({ id: "note-a", status: "read", ts: 500 });
    expect(reset).toHaveLength(3);
  });

  it("reproduces exactly the state the viewer was rewound to (git reset --hard semantics)", () => {
    const reset = resetLogAt(log, 300);
    expect(computeStatusAsOf(state(reset))).toEqual(computeStatusAsOf(state(log), 300));
  });
});

describe("squashStateUntil (Squash until here, ADR-0014)", () => {
  it("folds a net-no-op read/unread round-trip into the Snapshot as its absence (unread)", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
    ];
    const squashed = squashStateUntil(state(log), 300);
    expect(squashed.log).toEqual([]);
    expect(squashed.snapshot).toEqual({ "note-a": "unread" });
  });

  it("refreshes snapshotUpdatedAt to the real Squash execution time, not the folded cursorTs", () => {
    const log = [{ id: "note-a", status: "read", ts: 100 }];
    const before = Date.now();
    const squashed = squashStateUntil(state(log, {}, 1), 300);
    expect(squashed.snapshotUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(squashed.snapshotUpdatedAt).toBeLessThanOrEqual(Date.now());
    expect(squashed.snapshotUpdatedAt).not.toBe(300);
  });

  it("folds a net-changed id's final status into the Snapshot, removing all its in-window events", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-a", status: "read", ts: 300 },
    ];
    const squashed = squashStateUntil(state(log), 400);
    expect(squashed.log).toEqual([]);
    expect(squashed.snapshot).toEqual({ "note-a": "read" });
  });

  it("leaves events after the cursor untouched, and folds only ids affected up to the cursor", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-b", status: "read", ts: 250 },
      { id: "note-a", status: "read", ts: 500 },
    ];
    const squashed = squashStateUntil(state(log), 300);
    expect(squashed.log).toEqual([{ id: "note-a", status: "read", ts: 500 }]);
    expect(squashed.snapshot).toEqual({ "note-a": "unread", "note-b": "read" });
  });

  it("merges with (and can override) a pre-existing Snapshot", () => {
    const log = [{ id: "note-a", status: "read", ts: 200 }];
    const squashed = squashStateUntil(state(log, { "note-a": "unread", "note-z": "read" }), 300);
    expect(squashed.log).toEqual([]);
    expect(squashed.snapshot).toEqual({ "note-a": "read", "note-z": "read" });
  });

  it("preserves the folded status at every point at/after the cursor, including non-no-op history", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-b", status: "read", ts: 250 },
      { id: "note-a", status: "read", ts: 500 },
    ];
    const before = state(log);
    const squashed = squashStateUntil(before, 300);
    const asOf = (s: typeof before, ts: number, id: string) => computeStatusAsOf(s, ts).get(id) ?? "unread";
    expect(asOf(squashed, 300, "note-a")).toBe(asOf(before, 300, "note-a"));
    expect(asOf(squashed, 300, "note-b")).toBe(asOf(before, 300, "note-b"));
    expect(asOf(squashed, Infinity, "note-a")).toBe(asOf(before, Infinity, "note-a"));
    expect(asOf(squashed, Infinity, "note-b")).toBe(asOf(before, Infinity, "note-b"));
  });

  it("is a no-op on snapshot/log content when cursor is SNAPSHOT_CURSOR_TS (nothing precedes the Snapshot), but still refreshes snapshotUpdatedAt", () => {
    const log = [{ id: "note-a", status: "read", ts: 100 }];
    const squashed = squashStateUntil(state(log, { "note-z": "read" }), SNAPSHOT_CURSOR_TS);
    expect(squashed.snapshot).toEqual({ "note-z": "read" });
    expect(squashed.log).toEqual(log);
    expect(typeof squashed.snapshotUpdatedAt).toBe("number");
  });
});

describe("parseModifiedAt (search-index.json sync, REQ-EXPLORE-006/007)", () => {
  it("parses the 'YYYY-MM-DD HH:mm UTC' format used by search-index.json", () => {
    expect(parseModifiedAt("2026-08-24 18:24 UTC")).toBe(Date.parse("2026-08-24T18:24:00.000Z"));
  });

  it("returns undefined for an unparseable string", () => {
    expect(parseModifiedAt("not a date")).toBeUndefined();
  });

  it("returns undefined without throwing when modifiedAt is missing (unknown, ADR-0015)", () => {
    // search-index.json entries omit `modifiedAt` entirely for notes with
    // no git history, rather than serializing a stray `null`/placeholder.
    expect(parseModifiedAt(undefined)).toBeUndefined();
  });
});

describe("loadCursor/saveCursor (cursor persistence, REQ-EXPLORE-009, ADR-0014)", () => {
  it("defaults to null ('now') when nothing has been stored yet", () => {
    expect(loadCursor()).toBeNull();
  });

  it("round-trips the 'now' cursor (null)", () => {
    saveCursor(null);
    expect(loadCursor()).toBeNull();
  });

  it("round-trips the Snapshot cursor (SNAPSHOT_CURSOR_TS)", () => {
    saveCursor(SNAPSHOT_CURSOR_TS);
    expect(loadCursor()).toBe(SNAPSHOT_CURSOR_TS);
  });

  it("round-trips a specific past event timestamp", () => {
    saveCursor(1234567);
    expect(loadCursor()).toBe(1234567);
  });

  it("returns null rather than throwing when the stored value is corrupt JSON", () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, "{not valid json");
    expect(loadCursor()).toBeNull();
  });

  it("returns null rather than throwing when the stored value has an unrecognized mode", () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify({ mode: "bogus" }));
    expect(loadCursor()).toBeNull();
  });

  it("returns false from saveCursor (without throwing) when localStorage.setItem fails", () => {
    (localStorage as unknown as { simulateQuotaExceeded(): void }).simulateQuotaExceeded();
    expect(saveCursor(42)).toBe(false);
  });
});

describe("loadDrawerOpen/saveDrawerOpen (History drawer persistence, REQ-EXPLORE-009, ADR-0014)", () => {
  it("defaults to false (closed) when nothing has been stored yet", () => {
    expect(loadDrawerOpen()).toBe(false);
  });

  it("round-trips true (open)", () => {
    saveDrawerOpen(true);
    expect(loadDrawerOpen()).toBe(true);
  });

  it("round-trips false (closed)", () => {
    saveDrawerOpen(true);
    saveDrawerOpen(false);
    expect(loadDrawerOpen()).toBe(false);
  });

  it("returns false rather than throwing when the stored value is unrecognized", () => {
    localStorage.setItem(DRAWER_STORAGE_KEY, "garbage");
    expect(loadDrawerOpen()).toBe(false);
  });

  it("returns false from saveDrawerOpen (without throwing) when localStorage.setItem fails", () => {
    (localStorage as unknown as { simulateQuotaExceeded(): void }).simulateQuotaExceeded();
    expect(saveDrawerOpen(true)).toBe(false);
  });
});
