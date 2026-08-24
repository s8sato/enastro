import { beforeEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  appendEvent,
  computeStatusAsOf,
  getLastEventTimestamp,
  loadLog,
  parseModifiedAt,
  pruneLogUntil,
  resetLogAt,
} from "./exploration.mjs";

/**
 * Minimal in-memory localStorage mock (vitest's default environment is
 * plain Node, which has no `localStorage` global). Kept intentionally
 * small — just enough to exercise `loadLog`/`appendEvent`'s persistence
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

describe("loadLog (REQ-EXPLORE-001)", () => {
  it("returns an empty array when nothing has been stored yet", () => {
    expect(loadLog()).toEqual([]);
  });

  it("returns [] rather than throwing when the stored value is corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadLog()).toEqual([]);
  });

  it("returns [] rather than throwing when the stored value isn't an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadLog()).toEqual([]);
  });
});

describe("appendEvent (REQ-EXPLORE-001, REQ-EXPLORE-002)", () => {
  it("persists the new event and returns ok: true on success", () => {
    const { log, ok } = appendEvent([], "note-a", "read");
    expect(ok).toBe(true);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: "note-a", status: "read" });
    expect(loadLog()).toEqual(log);
  });

  it("still returns the appended event in-memory (but ok: false) when storage is full", () => {
    localStorage.simulateQuotaExceeded();
    const { log, ok, error } = appendEvent([], "note-a", "read");
    expect(ok).toBe(false);
    expect(error).toBeInstanceOf(Error);
    expect(log).toHaveLength(1);
    // The failed write must not have silently succeeded:
    expect(loadLog()).toEqual([]);
  });
});

describe("computeStatusAsOf (REQ-EXPLORE-001, REQ-EXPLORE-003)", () => {
  const log = [
    { id: "note-a", status: "read", ts: 100 },
    { id: "note-b", status: "read", ts: 200 },
    { id: "note-a", status: "unread", ts: 300 },
  ];

  it("defaults to folding the entire log (live/'now' view)", () => {
    const status = computeStatusAsOf(log);
    expect(status.get("note-a")).toBe("unread");
    expect(status.get("note-b")).toBe("read");
  });

  it("ignores events after the given cursor, enabling rewind", () => {
    const status = computeStatusAsOf(log, 150);
    expect(status.get("note-a")).toBe("read");
    expect(status.has("note-b")).toBe(false);
  });

  it("is unaffected by ids that no longer exist in the current graph (topology-change resilience)", () => {
    const status = computeStatusAsOf(log);
    // A deleted note's id simply remains an ordinary (harmless) map entry;
    // callers only ever look up ids that are still present in graph.json /
    // the note list, so stale ids never surface anywhere.
    expect(status.get("deleted-note")).toBeUndefined();
  });

  it("returns 'unread' semantics (absence) for notes with no events at all", () => {
    const status = computeStatusAsOf(log);
    expect(status.has("note-c")).toBe(false);
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
    expect(computeStatusAsOf(reset)).toEqual(computeStatusAsOf(log, 300));
  });
});

describe("pruneLogUntil (Prune until here, ADR-0014)", () => {
  it("removes an id's entire in-window history when it nets to no change (round-trip)", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
    ];
    const pruned = pruneLogUntil(log, 300);
    expect(pruned).toEqual([]);
  });

  it("keeps only the last in-window event for an id whose net status changed", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-a", status: "read", ts: 300 },
    ];
    const pruned = pruneLogUntil(log, 400);
    expect(pruned).toEqual([{ id: "note-a", status: "read", ts: 300 }]);
  });

  it("leaves events after the cursor, and other ids, untouched", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-b", status: "read", ts: 250 },
      { id: "note-a", status: "read", ts: 500 },
    ];
    const pruned = pruneLogUntil(log, 300);
    expect(pruned).toEqual([
      { id: "note-b", status: "read", ts: 250 },
      { id: "note-a", status: "read", ts: 500 },
    ]);
  });

  it("preserves the folded status at every point at/after the cursor (semantically: absence == 'unread')", () => {
    const log = [
      { id: "note-a", status: "read", ts: 100 },
      { id: "note-a", status: "unread", ts: 200 },
      { id: "note-b", status: "read", ts: 250 },
      { id: "note-a", status: "read", ts: 500 },
    ];
    const pruned = pruneLogUntil(log, 300);
    const asOf = (l: typeof log, id: string, ts: number) => computeStatusAsOf(l, ts).get(id) ?? "unread";
    expect(asOf(pruned, "note-a", 300)).toBe(asOf(log, "note-a", 300));
    expect(asOf(pruned, "note-b", 300)).toBe(asOf(log, "note-b", 300));
    expect(asOf(pruned, "note-a", Infinity)).toBe(asOf(log, "note-a", Infinity));
    expect(asOf(pruned, "note-b", Infinity)).toBe(asOf(log, "note-b", Infinity));
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
