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
