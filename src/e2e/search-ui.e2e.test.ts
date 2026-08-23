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
  outDir = mkdtempSync(path.join(tmpdir(), "enastro-e2e-"));
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

describe("browser E2E: search & tag filter & backlink navigation (REQ-UX-001/002/003)", () => {
  it("filters the note list via the search box (REQ-UX-001)", async () => {
    await page.goto(`${baseUrl}/index.html`);

    await page.waitForSelector("#tag-filters button");

    // Query text unique to note-a's own body: since inline wikilinks now
    // render with the target note's title as their label (ADR-0009), a
    // query like "Note A" would also match note-b's body (which links back
    // to note-a and would render that link as "Note A").
    await page.fill("#search-box", "inline-tag");

    await expect
      .poll(() => page.locator('li[data-id="note-a"]').isVisible())
      .toBe(true);
    await expect
      .poll(() => page.locator('li[data-id="note-b"]').isVisible())
      .toBe(false);
    await expect
      .poll(() => page.locator('li[data-id="note-c-alias"]').isVisible())
      .toBe(false);
  });

  it("filters the note list via AND tag selection (REQ-UX-002)", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.waitForSelector("#tag-filters button");

    await page.click('#tag-filters button[data-tag="example"]');

    await expect
      .poll(() => page.locator('li[data-id="note-a"]').isVisible())
      .toBe(true);
    await expect
      .poll(() => page.locator('li[data-id="note-b"]').isVisible())
      .toBe(false);
    await expect
      .poll(() => page.locator('li[data-id="note-c-alias"]').isVisible())
      .toBe(false);
    await expect
      .poll(() => page.locator('li[data-id="note-d-broken-link"]').isVisible())
      .toBe(false);
  });

  it("navigates from a backlink to the linking note (REQ-UX-003)", async () => {
    await page.goto(`${baseUrl}/notes/note-b.html`);

    await page.click('.backlinks a[href="note-a.html"]');

    await expect.poll(() => page.url()).toContain("/notes/note-a.html");
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note A");
  });

  it("navigates from an inline wikilink in the note body to the linked note (REQ-CONTENT-001)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);

    await page.click('article a:has-text("Note B")');

    await expect.poll(() => page.url()).toContain("/notes/note-b.html");
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note B");
  });

  it("clicking a tag on a note page jumps to the index page pre-filtered by that tag (REQ-UX-008)", async () => {
    await page.goto(`${baseUrl}/notes/note-a.html`);

    await page.click('a[href="../index.html?tags=example"]');

    await expect.poll(() => page.url()).toContain("/index.html?tags=example");
    await page.waitForSelector("#tag-filters button");
    await expect
      .poll(() => page.locator('#tag-filters button[data-tag="example"]').getAttribute("aria-pressed"))
      .toBe("true");
    await expect
      .poll(() => page.locator('li[data-id="note-a"]').isVisible())
      .toBe(true);
    await expect
      .poll(() => page.locator('li[data-id="note-b"]').isVisible())
      .toBe(false);
  });
});

describe("browser E2E: local-timezone last-modified display (REQ-UX-007)", () => {
  it("re-renders the UTC-fallback timestamp in the viewer's local timezone", async () => {
    const context = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    const jstPage = await context.newPage();
    try {
      await jstPage.goto(`${baseUrl}/notes/note-a.html`);

      await expect
        .poll(() => jstPage.locator("p.modified").textContent())
        .toMatch(/Last modified: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC\+09:00\)/);
    } finally {
      await jstPage.close();
      await context.close();
    }
  });
});
