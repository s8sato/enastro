import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, appendEvent, computeStatusAsOf, loadLog } from "./exploration.mjs";

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
