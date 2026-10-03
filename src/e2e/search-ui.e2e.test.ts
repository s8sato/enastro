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
    await page.goto(`${baseUrl}/`);

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
    await page.goto(`${baseUrl}/`);
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
    await page.goto(`${baseUrl}/notes/note-b/`);

    await page.click('.backlinks a[href="../note-a/"]');

    await expect.poll(() => page.url()).toContain("/notes/note-a/");
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note A");
  });

  it("navigates from an inline wikilink in the note body to the linked note (REQ-CONTENT-001)", async () => {
    await page.goto(`${baseUrl}/notes/note-a/`);

    await page.click('article a:has-text("Note B")');

    await expect.poll(() => page.url()).toContain("/notes/note-b/");
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note B");
  });

  it("clicking a tag on a note page jumps to the index page pre-filtered by that tag (REQ-UX-008)", async () => {
    await page.goto(`${baseUrl}/notes/note-a/`);

    await page.click('a[href="../../?tags=example"]');

    await expect.poll(() => page.url()).toContain("/?tags=example");
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

describe("browser E2E: search-term highlighting after navigation (REQ-UX-019)", () => {
  const markTexts = () => page.locator("article mark.search-hit").allTextContents();

  async function searchAndOpen(query: string, id: string) {
    await page.goto(`${baseUrl}/`);
    await page.waitForSelector("#tag-filters button");
    await page.fill("#search-box", query);
    await page.click(`li[data-id="${id}"] a`);
    await expect.poll(() => page.url()).toContain(`/notes/${id}/#hl=`);
  }

  it("highlights the search term in the note body after clicking a search result", async () => {
    await searchAndOpen("inline-tag", "note-a");

    await expect.poll(markTexts).toEqual(["inline-tag"]);
  });

  it("highlights every term of a multi-word query, case-insensitively", async () => {
    await searchAndOpen("NOTE links", "note-a");

    await expect.poll(async () => new Set((await markTexts()).map((text) => text.toLowerCase()))).toEqual(
      new Set(["note", "links"]),
    );
    // Wrapping matches in <mark> leaves the text itself unchanged.
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note A");
  });

  it("does not carry the highlight over to a note reached via a wikilink", async () => {
    await searchAndOpen("note", "note-a");
    await expect.poll(async () => (await markTexts()).length).toBeGreaterThan(0);

    await page.click('article a:has-text("Note B")');

    await expect.poll(() => page.url()).toMatch(/\/notes\/note-b\/$/);
    await expect.poll(() => page.locator("article h1").textContent()).toBe("Note B");
    expect(await markTexts()).toEqual([]);
  });

  it("leaves result links without a fragment when the search box is empty", async () => {
    await page.goto(`${baseUrl}/`);
    await page.waitForSelector("#tag-filters button");
    await page.fill("#search-box", "note");
    await page.fill("#search-box", "   ");

    await expect
      .poll(() => page.locator('li[data-id="note-a"] a').getAttribute("href"))
      .toBe("notes/note-a/");
  });

  it("highlights nothing when a note page is opened directly", async () => {
    await page.goto(`${baseUrl}/notes/note-a/`);
    await page.waitForSelector("article h1");

    expect(await markTexts()).toEqual([]);
  });

  it("treats a crafted fragment as plain text (no markup injection, no script errors)", async () => {
    const freshPage = await browser.newPage();
    const dialogs: string[] = [];
    const errors: string[] = [];
    freshPage.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    freshPage.on("pageerror", (error) => errors.push(error.message));
    try {
      const query = '<img src=x onerror=alert(1)> ( .* note';
      await freshPage.goto(`${baseUrl}/notes/note-a/#hl=${encodeURIComponent(query)}`);

      await expect
        .poll(() => freshPage.locator("article mark.search-hit").count())
        .toBeGreaterThan(0);
      expect(await freshPage.locator("article img").count()).toBe(0);
      expect(dialogs).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await freshPage.close();
    }
  });
});

describe("browser E2E: local-timezone last-modified display (REQ-UX-007)", () => {
  it("re-renders the UTC-fallback timestamp in the viewer's local timezone", async () => {
    const context = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    const jstPage = await context.newPage();
    try {
      await jstPage.goto(`${baseUrl}/notes/note-a/`);

      await expect
        .poll(() => jstPage.locator(".date-value[data-modified]").textContent())
        .toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      await expect.poll(() => jstPage.locator(".date-tz").textContent()).toBe("UTC+9");
    } finally {
      await jstPage.close();
      await context.close();
    }
  });
});
