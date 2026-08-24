import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../build/site.js";
import { serveStatic } from "./static-server.js";

const vaultDir = path.resolve(fileURLToPath(import.meta.url), "../../../fixtures/basic-vault");

let outDir: string;
let server: Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "enastro-exploration-e2e-"));
  buildSite(vaultDir, outDir);

  ({ server, baseUrl } = await serveStatic(outDir));
  browser = await chromium.launch();
  page = await browser.newPage();
}, 60_000);

afterAll(async () => {
  await page?.close();
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("browser E2E: node exploration status (REQ-EXPLORE-001~005)", () => {
  it("marks a note as read via the note page button, dimming its bullet on the index page", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);
    expect(await markReadButton.textContent()).toBe("Mark as read");

    await markReadButton.click();
    expect(await markReadButton.textContent()).toBe("Mark as unread");
    expect(await markReadButton.getAttribute("aria-pressed")).toBe("true");

    await page.goto(`${baseUrl}/index.html`);
    await expect
      .poll(() => page.locator('li[data-id="note-a"]').getAttribute("class"))
      .toContain("explored");
    const noteBClass = await page.locator('li[data-id="note-b"]').getAttribute("class");
    expect(noteBClass ?? "").not.toContain("explored");
  });

  it("dims the corresponding node and its outgoing particles on the graph page (REQ-EXPLORE-005)", async () => {
    await page.goto(`${baseUrl}/graph.html`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");

    await expect
      .poll(() => page.evaluate(() => (globalThis as any).window.__enastroGraph.isExplored("note-a")))
      .toBe(true);
    expect(await page.evaluate(() => (globalThis as any).window.__enastroGraph.isExplored("note-b"))).toBe(
      false,
    );
  });

  it("supports rewinding to a past state via the shared history panel, and returning to now (REQ-EXPLORE-003)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBeGreaterThan(0);

    // Note is currently "read" (from the previous test's persisted
    // localStorage); rewinding to its own history entry re-derives that
    // same state, but puts the UI into read-only "viewing the past" mode.
    await historyEntries.first().click();
    expect(await markReadButton.isDisabled()).toBe(true);

    const returnToNow = page.locator("#exploration-return-to-now");
    await expect.poll(() => returnToNow.isVisible()).toBe(true);
    await returnToNow.click();
    expect(await markReadButton.isDisabled()).toBe(false);
  });

  it("shows a dismissible warning instead of losing data when localStorage is full (REQ-EXPLORE-002)", async () => {
    await page.goto(`${baseUrl}/notes/note-b.html`);

    // Simulate a full quota by making any further writes throw, mirroring a
    // real QuotaExceededError, without needing to actually fill storage.
    await page.evaluate(() => {
      const proto = Object.getPrototypeOf(localStorage);
      (globalThis as any).__originalSetItem = proto.setItem;
      proto.setItem = () => {
        const error = new Error("Quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      };
    });

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);
    await markReadButton.click();

    // The click still takes visible effect immediately (in-memory), even
    // though persistence failed:
    expect(await markReadButton.textContent()).toBe("Mark as unread");

    await page.click("#exploration-rewind-toggle");
    const warning = page.locator("#exploration-storage-warning");
    await expect.poll(() => warning.isVisible()).toBe(true);
    await warning.click();
    await expect.poll(() => warning.isHidden()).toBe(true);

    await page.evaluate(() => {
      const proto = Object.getPrototypeOf(localStorage);
      proto.setItem = (globalThis as any).__originalSetItem;
    });
  });
});

describe("browser E2E: exploration-status refinements (REQ-EXPLORE-007, REQ-EXPLORE-008)", () => {
  const STORAGE_KEY = "enastro:exploration:v1";

  it("closes the rewind panel when returning to now", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBeGreaterThan(0);
    await historyEntries.first().click();

    const panel = page.locator("#exploration-rewind-panel");
    await expect.poll(() => panel.isVisible()).toBe(true);

    await page.click("#exploration-return-to-now");
    await expect.poll(() => panel.isHidden()).toBe(true);
  });

  it("highlights the history entry currently being viewed via rewind", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify([
            { id: "note-a", status: "read", ts: base + 100 },
            { id: "note-a", status: "unread", ts: base + 200 },
            { id: "note-a", status: "read", ts: base + 300 },
          ]),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Initial state" entry always appended
    // at the end of the list.
    await expect.poll(() => historyEntries.count()).toBe(4);

    // Live/"now": no entry should be highlighted.
    for (const entry of await historyEntries.all()) {
      expect((await entry.getAttribute("class")) ?? "").not.toContain("active");
    }

    await historyEntries.nth(1).click();
    await expect.poll(() => historyEntries.nth(1).getAttribute("class")).toContain("active");
    expect(await historyEntries.nth(1).getAttribute("aria-current")).toBe("true");
    // Only the rewound-to entry is highlighted, not the others:
    expect((await historyEntries.first().getAttribute("class")) ?? "").not.toContain("active");

    await page.click("#exploration-return-to-now");
    for (const entry of await historyEntries.all()) {
      expect((await entry.getAttribute("class")) ?? "").not.toContain("active");
    }
  });

  it("always shows a selectable 'Initial state' entry at the end of the history list, resetting all notes to unread (REQ-EXPLORE-003)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(key, JSON.stringify([{ id: "note-a", status: "read", ts: Date.now() }]));
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBe(2);

    const initialEntry = historyEntries.last();
    expect(await initialEntry.textContent()).toMatch(/Initial state/);
    // No timezone marker in any history entry's timestamp:
    for (const entry of await historyEntries.all()) {
      expect(await entry.textContent()).not.toMatch(/UTC/);
    }

    await initialEntry.click();
    await expect.poll(() => initialEntry.getAttribute("class")).toContain("active");
    expect(await initialEntry.getAttribute("aria-current")).toBe("true");
    // Rewound to the initial state: the note reads as unread again, and
    // status-changing is disabled (read-only, like any other rewind).
    expect(await markReadButton.textContent()).toBe("Mark as read");
    expect(await markReadButton.isDisabled()).toBe(true);

    await page.click("#exploration-return-to-now");
    expect(await markReadButton.textContent()).toBe("Mark as unread");
    expect(await markReadButton.isDisabled()).toBe(false);
  });

  it("shows a read-at timestamp only while the note is read, doubling as the read/unread cue", async () => {
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.goto(`${baseUrl}/notes/note-c-alias.html`);

    const markReadButton = page.locator("[data-mark-read]");
    const readAt = page.locator("[data-read-at]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);
    await expect.poll(() => readAt.isHidden()).toBe(true);

    await markReadButton.click();
    await expect.poll(() => readAt.isVisible()).toBe(true);
    expect(await readAt.textContent()).toMatch(/^Read /);

    await markReadButton.click();
    await expect.poll(() => readAt.isHidden()).toBe(true);
  });

  it("notifies with the specific note id when a logged note no longer exists in the current build", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify([{ id: "note-does-not-exist", status: "read", ts: Date.now() }]),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const notice = page.locator("#exploration-missing-notice");
    await expect.poll(() => notice.isVisible()).toBe(true);
    expect(await notice.textContent()).toMatch(/no longer exist/i);
    expect(await notice.textContent()).toContain("note-does-not-exist");

    await notice.click();
    await expect.poll(() => notice.isHidden()).toBe(true);
  });

  it("auto-reverts to unread and notifies with the specific note id when it changed after being marked read (REQ-EXPLORE-007)", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.evaluate(
      ({ key }) => {
        // A read event dated far in the past is guaranteed to predate the
        // note's build-time modifiedAt, triggering the auto-unread sync.
        localStorage.setItem(key, JSON.stringify([{ id: "note-a", status: "read", ts: 1 }]));
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await expect
      .poll(() => page.locator('li[data-id="note-a"]').getAttribute("class"))
      .not.toContain("explored");

    await page.click("#exploration-rewind-toggle");
    const notice = page.locator("#exploration-auto-unread-notice");
    await expect.poll(() => notice.isVisible()).toBe(true);
    expect(await notice.textContent()).toMatch(/marked unread again/);
    expect(await notice.textContent()).toContain("note-a");

    // The two notices are shown in independent, separately-dismissible
    // boxes (not merged into one):
    const missingNotice = page.locator("#exploration-missing-notice");
    expect(await missingNotice.isHidden()).toBe(true);

    const historyEntries = page.locator("#exploration-history-list button");
    // The original seeded "read" event plus the auto-appended "unread" one,
    // plus the synthetic "Initial state" entry:
    await expect.poll(() => historyEntries.count()).toBe(3);
  });

  it("supports Reset to here, permanently discarding history after the cursor (REQ-EXPLORE-008)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        // Timestamps are anchored to "now" (rather than tiny fixed numbers)
        // so they postdate the note's build-time modifiedAt — otherwise the
        // REQ-EXPLORE-007 auto-unread sync would inject an extra event.
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify([
            { id: "note-a", status: "read", ts: base + 100 },
            { id: "note-a", status: "unread", ts: base + 200 },
            { id: "note-a", status: "read", ts: base + 300 },
          ]),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Initial state" entry:
    await expect.poll(() => historyEntries.count()).toBe(4);
    // Entries are listed newest-first; rewind to the middle (ts: base+200).
    await historyEntries.nth(1).click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#exploration-reset-here");

    // Events at/before the cursor (base+100, base+200) are kept untouched;
    // the event after the cursor (base+300, "read") is permanently gone —
    // this actually reverts to the rewound ("unread") state. (+1 for the
    // synthetic "Initial state" entry, always present.)
    await expect.poll(() => historyEntries.count()).toBe(3);
    const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored.every((event: { status: string }) => event.status !== undefined)).toBe(true);
    expect(stored[stored.length - 1].status).toBe("unread"); // the rewound-to state

    const markReadButton = page.locator("[data-mark-read]");
    expect(await markReadButton.textContent()).toBe("Mark as read");
  });

  it("supports Prune until here, removing net-no-op read/unread round-trips (REQ-EXPLORE-008)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify([
            { id: "note-a", status: "read", ts: base + 100 },
            { id: "note-a", status: "unread", ts: base + 200 },
            { id: "note-b", status: "read", ts: base + 250 },
          ]),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Initial state" entry:
    await expect.poll(() => historyEntries.count()).toBe(4);
    // Rewind to the most recent entry so "Prune until here" covers everything.
    await historyEntries.first().click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#exploration-prune-here");

    // note-a's read→unread round trip nets to no change and is fully
    // annihilated; note-b's single "read" event survives. (+1 for the
    // synthetic "Initial state" entry, always present.)
    await expect.poll(() => historyEntries.count()).toBe(2);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toMatch(/"id":"note-b"/);
  });
});
