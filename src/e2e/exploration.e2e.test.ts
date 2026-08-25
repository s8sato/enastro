import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSite } from "../build/site.js";
import { serveStatic } from "./static-server.js";

const vaultDir = path.resolve(fileURLToPath(import.meta.url), "../../../fixtures/basic-vault");

/** Persisted rewind-cursor/drawer-open state keys (REQ-EXPLORE-009, ADR-0014). */
const CURSOR_STORAGE_KEY = "enastro:exploration:cursor:v1";
const DRAWER_STORAGE_KEY = "enastro:exploration:drawer:v1";

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

// Each test's own history-drawer/cursor expectations assume a fresh "now"/
// closed-drawer starting point, but both are now persisted across page
// navigation (REQ-EXPLORE-009) and the shared `page` carries `localStorage`
// across every test in this file — so without this, a test that leaves the
// drawer open or the cursor rewound would silently change the next test's
// starting state (e.g. clicking the toggle button would *close* an
// already-restored-open drawer instead of opening it). `about:blank` (the
// very first test, before any `page.goto`) has no accessible `localStorage`,
// hence the try/catch.
beforeEach(async () => {
  await page?.evaluate(
    ({ cursorKey, drawerKey }) => {
      try {
        localStorage.removeItem(cursorKey);
        localStorage.removeItem(drawerKey);
      } catch {
        // about:blank or similar — nothing to clear.
      }
    },
    { cursorKey: CURSOR_STORAGE_KEY, drawerKey: DRAWER_STORAGE_KEY },
  );
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

    const returnToNow = page.locator("#exploration-return-to-now");
    // At "now" (no persisted cursor yet), Return is disabled — there's
    // nothing to return from (REQ-EXPLORE-009).
    await expect.poll(() => returnToNow.isDisabled()).toBe(true);

    // Note is currently "read" (from the previous test's persisted
    // localStorage); rewinding to its own history entry re-derives that
    // same state, but puts the UI into read-only "viewing the past" mode.
    await historyEntries.first().click();
    expect(await markReadButton.isDisabled()).toBe(true);
    expect(await returnToNow.isDisabled()).toBe(false);

    await returnToNow.click();
    expect(await markReadButton.isDisabled()).toBe(false);
    expect(await returnToNow.isDisabled()).toBe(true);
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
  const STORAGE_KEY = "enastro:exploration:v2";

  it("keeps the rewind panel open after returning to now, showing the cursor is back at 'now'", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBeGreaterThan(0);
    await historyEntries.first().click();

    const panel = page.locator("#exploration-rewind-panel");
    await expect.poll(() => panel.isVisible()).toBe(true);

    // No button click (Return/Squash/Reset) closes the drawer — the cursor
    // position stays visible so the user can see the effect of what they
    // just clicked without having to reopen it.
    await page.click("#exploration-return-to-now");
    await expect.poll(() => panel.isVisible()).toBe(true);
  });

  it("highlights the history entry currently being viewed via rewind", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [
              { id: "note-a", status: "read", ts: base + 100 },
              { id: "note-a", status: "unread", ts: base + 200 },
              { id: "note-a", status: "read", ts: base + 300 },
            ],
            snapshotUpdatedAt: base,
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Snapshot" entry always appended
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

  it("always shows a selectable 'Snapshot' entry at the end of the history list, resetting all notes to unread (REQ-EXPLORE-003)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [{ id: "note-a", status: "read", ts: Date.now() }],
            snapshotUpdatedAt: Date.now(),
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    const markReadButton = page.locator("[data-mark-read]");
    await expect.poll(() => markReadButton.isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBe(2);

    const snapshotEntry = historyEntries.last();
    expect(await snapshotEntry.textContent()).toMatch(/Snapshot/);
    // No timezone marker in any history entry's timestamp:
    for (const entry of await historyEntries.all()) {
      expect(await entry.textContent()).not.toMatch(/UTC/);
    }

    await snapshotEntry.click();
    await expect.poll(() => snapshotEntry.getAttribute("class")).toContain("active");
    expect(await snapshotEntry.getAttribute("aria-current")).toBe("true");
    // Rewound to the Snapshot: the note reads as unread again, and
    // status-changing is disabled (read-only, like any other rewind).
    expect(await markReadButton.textContent()).toBe("Mark as read");
    expect(await markReadButton.isDisabled()).toBe(true);

    await page.click("#exploration-return-to-now");
    expect(await markReadButton.textContent()).toBe("Mark as unread");
    expect(await markReadButton.isDisabled()).toBe(false);
  });

  it("shows a timestamp on the Snapshot's history row, present from the very first load (ADR-0014)", async () => {
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.goto(`${baseUrl}/notes/note-a.html`);

    // Even with zero read/unread actions taken yet, the Snapshot row already
    // carries a timestamp — it's persisted eagerly on the very first load.
    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBe(1);
    const snapshotEntry = historyEntries.last();
    const beforeText = (await snapshotEntry.textContent()) ?? "";
    expect(beforeText).toMatch(/Snapshot/);
    expect(beforeText).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);

    // Reloading again must NOT change the timestamp (it's only set once,
    // at first initialization, not recomputed on every load).
    await page.reload();
    await page.click("#exploration-rewind-toggle");
    await expect.poll(() => historyEntries.count()).toBe(1);
    expect(await historyEntries.last().textContent()).toBe(beforeText);
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
          JSON.stringify({
            snapshot: {},
            log: [{ id: "note-does-not-exist", status: "read", ts: Date.now() }],
            snapshotUpdatedAt: Date.now(),
          }),
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
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [{ id: "note-a", status: "read", ts: 1 }],
            snapshotUpdatedAt: 1,
          }),
        );
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
    // plus the synthetic "Snapshot" entry:
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
          JSON.stringify({
            snapshot: {},
            log: [
              { id: "note-a", status: "read", ts: base + 100 },
              { id: "note-a", status: "unread", ts: base + 200 },
              { id: "note-a", status: "read", ts: base + 300 },
            ],
            snapshotUpdatedAt: base,
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Snapshot" entry:
    await expect.poll(() => historyEntries.count()).toBe(4);
    // Entries are listed newest-first; rewind to the middle (ts: base+200).
    await historyEntries.nth(1).click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#exploration-reset-here");

    // Events at/before the cursor (base+100, base+200) are kept untouched;
    // the event after the cursor (base+300, "read") is permanently gone —
    // this actually reverts to the rewound ("unread") state. (+1 for the
    // synthetic "Snapshot" entry, always present.)
    await expect.poll(() => historyEntries.count()).toBe(3);
    const stored = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '{"snapshot":{},"log":[]}',
    );
    expect(stored.log).toHaveLength(2);
    expect(stored.log.every((event: { status: string }) => event.status !== undefined)).toBe(true);
    expect(stored.log[stored.log.length - 1].status).toBe("unread"); // the rewound-to state

    const markReadButton = page.locator("[data-mark-read]");
    expect(await markReadButton.textContent()).toBe("Mark as read");

    // "Reset to here" lands the cursor on the new "now" (REQ-EXPLORE-009):
    // Return/Reset are disabled again, and no history entry is highlighted.
    const returnToNow = page.locator("#exploration-return-to-now");
    const resetHere = page.locator("#exploration-reset-here");
    expect(await returnToNow.isDisabled()).toBe(true);
    expect(await resetHere.isDisabled()).toBe(true);
    for (const entry of await historyEntries.all()) {
      expect((await entry.getAttribute("class")) ?? "").not.toContain("active");
    }
  });

  it("supports Squash until here, folding read/unread history into the Snapshot (REQ-EXPLORE-008)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    const base = Date.now() - 60_000;
    await page.evaluate(
      ({ key, base }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [
              { id: "note-a", status: "read", ts: base + 100 },
              { id: "note-a", status: "unread", ts: base + 200 },
              { id: "note-b", status: "read", ts: base + 250 },
            ],
            snapshotUpdatedAt: base,
          }),
        );
      },
      { key: STORAGE_KEY, base },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    // 3 real events + the synthetic "Snapshot" entry:
    await expect.poll(() => historyEntries.count()).toBe(4);
    // Before squashing, the Snapshot row still shows the seeded (old) time.
    const snapshotEntry = historyEntries.last();
    const beforeSquashText = (await snapshotEntry.textContent()) ?? "";
    expect(beforeSquashText).toMatch(/Snapshot/);
    // Rewind to the most recent entry so "Squash until here" covers everything.
    await historyEntries.first().click();

    const beforeSquashAt = Date.now();
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#exploration-squash-here");

    // All 3 events are folded into the Snapshot and removed from the log:
    // note-a's read→unread round trip nets to "unread", note-b's single
    // "read" event nets to "read". (+1 for the synthetic "Snapshot" entry,
    // always present.)
    await expect.poll(() => historyEntries.count()).toBe(1);
    const stored = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '{"snapshot":{},"log":[]}',
    );
    expect(stored.log).toEqual([]);
    expect(stored.snapshot).toEqual({ "note-a": "unread", "note-b": "read" });
    // The Snapshot's updated-at timestamp is refreshed to the real Squash
    // execution time — not left at the old seeded `base`, and not the
    // rewound cursor time either (they're both well before `beforeSquashAt`).
    expect(stored.snapshotUpdatedAt).toBeGreaterThanOrEqual(beforeSquashAt);

    // ...and the History drawer's Snapshot row reflects the new timestamp,
    // no longer showing the pre-Squash text.
    const afterSquashText = await historyEntries.last().textContent();
    expect(afterSquashText).toMatch(/Snapshot/);
    expect(afterSquashText).not.toBe(beforeSquashText);

    // "Squash until here" lands the cursor on the new Snapshot
    // (REQ-EXPLORE-009): its row is highlighted, and Squash (now a no-op —
    // nothing precedes the Snapshot) is disabled, while Return/Reset (which
    // act relative to a non-"now" cursor) are enabled.
    await expect.poll(() => historyEntries.last().getAttribute("class")).toContain("active");
    expect(await historyEntries.last().getAttribute("aria-current")).toBe("true");
    const squashHere = page.locator("#exploration-squash-here");
    const returnToNow = page.locator("#exploration-return-to-now");
    const resetHere = page.locator("#exploration-reset-here");
    expect(await squashHere.isDisabled()).toBe(true);
    expect(await returnToNow.isDisabled()).toBe(false);
    expect(await resetHere.isDisabled()).toBe(false);

    // Net effect is unchanged after the squash: note-a still reads unread.
    const markReadButton = page.locator("[data-mark-read]");
    expect(await markReadButton.textContent()).toBe("Mark as read");
  });

  it("supports Squash until here while live ('now'), folding the entire log into the Snapshot (REQ-EXPLORE-009)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [
              { id: "note-a", status: "read", ts: base + 100 },
              { id: "note-b", status: "read", ts: base + 200 },
            ],
            snapshotUpdatedAt: base,
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    // Cursor stays at "now" (no persisted cursor key from this seed):
    await page.evaluate((key) => localStorage.removeItem(key), CURSOR_STORAGE_KEY);
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const squashHere = page.locator("#exploration-squash-here");
    // Squash is enabled at "now" — it's only disabled once the cursor
    // already *is* the Snapshot (REQ-EXPLORE-009).
    expect(await squashHere.isDisabled()).toBe(false);

    page.once("dialog", (dialog) => dialog.accept());
    await squashHere.click();

    const historyEntries = page.locator("#exploration-history-list button");
    // Both events folded into the Snapshot, leaving only the Snapshot row:
    await expect.poll(() => historyEntries.count()).toBe(1);
    const stored = JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '{"snapshot":{},"log":[]}',
    );
    expect(stored.log).toEqual([]);
    expect(stored.snapshot).toEqual({ "note-a": "read", "note-b": "read" });
    expect(await squashHere.isDisabled()).toBe(true);
  });

  it("persists the rewind cursor across page navigation, restoring the same highlighted history entry (REQ-EXPLORE-009)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate(
      ({ key }) => {
        const base = Date.now() - 60_000;
        localStorage.setItem(
          key,
          JSON.stringify({
            snapshot: {},
            log: [{ id: "note-a", status: "read", ts: base + 100 }],
            snapshotUpdatedAt: base,
          }),
        );
      },
      { key: STORAGE_KEY },
    );
    await page.reload();

    await page.click("#exploration-rewind-toggle");
    const historyEntries = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntries.count()).toBeGreaterThan(0);
    await historyEntries.first().click();
    await expect.poll(() => historyEntries.first().getAttribute("class")).toContain("active");

    // Navigate away to a different page and back — the cursor stays
    // rewound rather than resetting to "now" (REQ-EXPLORE-009, ADR-0014).
    // The History drawer's own open state is also persisted (it was opened
    // above), so it's already showing again — no need to click the toggle,
    // which would otherwise *close* an already-restored-open drawer.
    await page.goto(`${baseUrl}/index.html`);
    await page.goto(`${baseUrl}/notes/note-a.html`);
    const historyEntriesAfterNav = page.locator("#exploration-history-list button");
    await expect.poll(() => historyEntriesAfterNav.count()).toBeGreaterThan(0);
    await expect.poll(() => historyEntriesAfterNav.first().getAttribute("class")).toContain("active");
    const markReadButton = page.locator("[data-mark-read]");
    expect(await markReadButton.isDisabled()).toBe(true); // still read-only (rewound)

    await page.click("#exploration-return-to-now");
  });

  it("persists the History drawer's open/closed state across page navigation (REQ-EXPLORE-009)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await page.evaluate((key) => localStorage.setItem(key, "closed"), DRAWER_STORAGE_KEY);
    await page.reload();
    const panel = page.locator("#exploration-rewind-panel");
    await expect.poll(() => panel.isVisible()).toBe(false);

    await page.click("#exploration-rewind-toggle");
    await expect.poll(() => panel.isVisible()).toBe(true);

    await page.goto(`${baseUrl}/index.html`);
    await expect.poll(() => page.locator("#exploration-rewind-panel").isVisible()).toBe(true);

    await page.click("#exploration-rewind-toggle");
    await expect.poll(() => page.locator("#exploration-rewind-panel").isVisible()).toBe(false);
    await page.goto(`${baseUrl}/notes/note-a.html`);
    await expect.poll(() => page.locator("#exploration-rewind-panel").isVisible()).toBe(false);
  });
});
