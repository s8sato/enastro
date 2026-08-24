import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  THEMES,
  angleForIndex,
  isValidTheme,
  pointOnCircle,
  readStoredTheme,
  storeTheme,
} from "./theme-switcher.mjs";

/**
 * Minimal in-memory localStorage mock (vitest's default environment is
 * plain Node, which has no `localStorage` global). Same pattern as
 * exploration.test.ts's MemoryStorage.
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

describe("THEMES (REQ-UX-011)", () => {
  it("defines exactly 12 themes, each with a unique id", () => {
    expect(THEMES).toHaveLength(12);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(12);
  });

  it("includes the default theme", () => {
    expect(THEMES.some((theme) => theme.id === DEFAULT_THEME)).toBe(true);
  });
});

describe("isValidTheme", () => {
  it("accepts every theme id", () => {
    for (const theme of THEMES) {
      expect(isValidTheme(theme.id)).toBe(true);
    }
  });

  it("rejects unknown ids", () => {
    expect(isValidTheme("not-a-theme")).toBe(false);
    expect(isValidTheme("")).toBe(false);
  });
});

describe("readStoredTheme / storeTheme", () => {
  it("returns undefined when nothing has been stored yet", () => {
    expect(readStoredTheme()).toBeUndefined();
  });

  it("round-trips a stored valid theme", () => {
    expect(storeTheme("aurora")).toBe(true);
    expect(readStoredTheme()).toBe("aurora");
  });

  it("returns undefined for a corrupt/invalid stored value", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-real-theme");
    expect(readStoredTheme()).toBeUndefined();
  });

  it("returns false from storeTheme, but doesn't throw, when storage quota is exceeded", () => {
    (localStorage as unknown as MemoryStorage).simulateQuotaExceeded();
    expect(storeTheme("void")).toBe(false);
  });

  it("returns undefined from readStoredTheme, but doesn't throw, when localStorage.getItem throws", () => {
    const throwing: Storage = {
      ...localStorage,
      getItem() {
        throw new Error("boom");
      },
    };
    globalThis.localStorage = throwing;
    expect(readStoredTheme()).toBeUndefined();
  });
});

describe("angleForIndex / pointOnCircle (dial layout)", () => {
  it("places index 0 at the top (-90°)", () => {
    expect(angleForIndex(0, 12)).toBe(-90);
  });

  it("evenly spaces all indices around the full circle", () => {
    const total = 12;
    const angles = Array.from({ length: total }, (_, i) => angleForIndex(i, total));
    for (let i = 1; i < angles.length; i++) {
      const current = angles[i];
      const previous = angles[i - 1];
      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      expect((current as number) - (previous as number)).toBeCloseTo(360 / total);
    }
  });

  it("converts an angle+radius into an {x, y} offset", () => {
    // -90° is "up": x=0, y=-radius (screen coordinates, y grows downward).
    const { x, y } = pointOnCircle(-90, 100);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-100);
  });
});
