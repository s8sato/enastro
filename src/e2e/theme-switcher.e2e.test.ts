import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../build/site.js";
import { serveStatic } from "./static-server.js";

const vaultDir = path.resolve(fileURLToPath(import.meta.url), "../../../fixtures/basic-vault");

let outDir: string;
let server: Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "enastro-theme-switcher-e2e-"));
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

afterEach(async () => {
  // Themes are pure client-side preference state (REQ-UX-011); reset it
  // between tests so each test starts from the default (Moon) theme.
  await page.evaluate(() => localStorage.removeItem("enastro:theme:v1"));
});

describe("browser E2E: 12-theme switcher (REQ-UX-011)", () => {
  it("persists a theme choice across index/note/graph navigation via the <select>", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#theme-trigger");
    await page.locator("#theme-select").selectOption("aurora");

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("aurora");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("enastro:theme:v1")))
      .toBe("aurora");

    await page.goto(`${baseUrl}/notes/note-a.html`);
    // The FOUC-prevention inline <head> script applies the stored theme
    // before this module even loads, so it should already be set by the
    // time the page is interactive.
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("aurora");

    await page.goto(`${baseUrl}/graph.html`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("aurora");
  });

  it("supports choosing a theme purely via keyboard on the accessible <select>, without the dial", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#theme-trigger");

    const select = page.locator("#theme-select");
    await select.focus();
    await select.selectOption("void");
    await select.dispatchEvent("change");

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("void");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("enastro:theme:v1")))
      .toBe("void");
  });

  it("reverts an uncommitted dial hover-preview when the dialog is closed via Escape", async () => {
    await page.goto(`${baseUrl}/index.html`);
    await page.click("#theme-trigger");
    await page.locator("#theme-select").selectOption("nova");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("nova");

    // Hover a different theme's dial point to preview it without committing.
    await page.locator('.theme-dial-point[data-theme="void"]').hover();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("void");

    await page.keyboard.press("Escape");

    // Closing without a click/Enter commit should revert to the last
    // committed theme ("nova"), not persist the hover-previewed one.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("nova");
    expect(await page.evaluate(() => localStorage.getItem("enastro:theme:v1"))).toBe("nova");
  });
});
