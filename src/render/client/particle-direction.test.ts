import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DIRECTION,
  STORAGE_KEY,
  isValidDirection,
  readStoredDirection,
  resolveParticleEndpoints,
  storeDirection,
} from "./particle-direction.mjs";

/**
 * Minimal in-memory localStorage mock (vitest's default environment is
 * plain Node, which has no `localStorage` global). Same pattern as
 * theme-switcher.test.ts's MemoryStorage.
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

describe("isValidDirection", () => {
  it("accepts the two known directions", () => {
    expect(isValidDirection("backlink")).toBe(true);
    expect(isValidDirection("wikilink")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isValidDirection("not-a-direction")).toBe(false);
    expect(isValidDirection("")).toBe(false);
  });

  it("includes the default direction", () => {
    expect(isValidDirection(DEFAULT_DIRECTION)).toBe(true);
  });
});

describe("readStoredDirection / storeDirection", () => {
  it("returns undefined when nothing has been stored yet", () => {
    expect(readStoredDirection()).toBeUndefined();
  });

  it("round-trips a stored valid direction", () => {
    expect(storeDirection("wikilink")).toBe(true);
    expect(readStoredDirection()).toBe("wikilink");
  });

  it("returns undefined for a corrupt/invalid stored value", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-real-direction");
    expect(readStoredDirection()).toBeUndefined();
  });

  it("returns false from storeDirection, but doesn't throw, when storage quota is exceeded", () => {
    (localStorage as unknown as MemoryStorage).simulateQuotaExceeded();
    expect(storeDirection("wikilink")).toBe(false);
  });
});

describe("resolveParticleEndpoints", () => {
  const source = { id: "note-a" };
  const target = { id: "note-b" };

  it("under 'backlink', departs from target (the dependency) toward source (the dependent)", () => {
    expect(resolveParticleEndpoints("backlink", source, target)).toEqual({ from: target, to: source });
  });

  it("under 'wikilink', departs from source (referencing note) toward target (referenced note)", () => {
    expect(resolveParticleEndpoints("wikilink", source, target)).toEqual({ from: source, to: target });
  });
});
