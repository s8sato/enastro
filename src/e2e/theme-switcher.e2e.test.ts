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
  // Also reset exploration status (REQ-EXPLORE-*) since one test marks
  // note-a read to exercise the mark-read icon's theme-reactive color.
  await page.evaluate(() => {
    localStorage.removeItem("enastro:theme:v1");
    localStorage.removeItem("enastro:exploration:v1");
  });
});

describe("browser E2E: 12-theme switcher (REQ-UX-011)", () => {
  it("persists a theme choice across index/note/graph navigation via the <select>", async () => {
    await page.goto(`${baseUrl}/`);
    await page.click("#theme-trigger");
    await page.locator("#theme-select").selectOption("aurora");

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("aurora");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("enastro:theme:v1")))
      .toBe("aurora");

    await page.goto(`${baseUrl}/notes/note-a/`);
    // The FOUC-prevention inline <head> script applies the stored theme
    // before this module even loads, so it should already be set by the
    // time the page is interactive.
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("aurora");

    await page.goto(`${baseUrl}/graph/`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("aurora");
  });

  it("supports choosing a theme purely via keyboard on the accessible <select>, without the dial", async () => {
    await page.goto(`${baseUrl}/`);
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
    await page.goto(`${baseUrl}/`);
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

  it("updates the graph's node fill color to the active theme's accent (REQ-UX-011)", async () => {
    await page.goto(`${baseUrl}/graph/`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");

    await page.click("#theme-trigger");
    await page.locator("#theme-select").selectOption("aurora");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("aurora");

    // Aurora's --accent is #7dffb3 (see THEMES in theme-switcher.mjs);
    // unexplored nodes are always drawn in the active theme's accent color.
    const nodeColor = await page.evaluate(() =>
      (globalThis as any).window.__enastroGraph.getNodeColor("note-a"),
    );
    expect(nodeColor).toBe(0x7dffb3);
  });

  it("updates the mark-read icon's color to the active theme's accent once a note is read (REQ-UX-011)", async () => {
    await page.goto(`${baseUrl}/`);
    await page.click("#theme-trigger");
    await page.locator("#theme-select").selectOption("aurora");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("enastro:theme:v1")))
      .toBe("aurora");

    await page.goto(`${baseUrl}/notes/note-a/`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("aurora");

    await page.click("[data-mark-read]");
    await expect
      .poll(() => page.locator("[data-mark-read]").getAttribute("aria-pressed"))
      .toBe("true");

    // `.mark-read-button`'s background-color has a 160ms CSS transition
    // (site.css), so poll rather than reading immediately after the click.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const button = document.querySelector(".mark-read-button") as Element;
          const resolved = getComputedStyle(button, "::before").backgroundColor;
          // Browsers may serialize a computed color in formats other than
          // `rgb(...)` (e.g. `oklab(...)`); canvas fillStyle accepts (and
          // normalizes) any valid CSS <color>, so read back concrete sRGB
          // bytes via a 1x1 canvas instead of parsing the string directly.
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = resolved;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(",");
        }),
      )
      // #7dffb3 == rgb(125, 255, 179)
      .toBe("125,255,179");
  });
});
