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
  outDir = mkdtempSync(path.join(tmpdir(), "enastro-particle-direction-e2e-"));
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
  // Particle direction is pure client-side preference state (REQ-UX-012);
  // reset it between tests so each test starts from the default
  // ("wikilink" — `fixtures/basic-vault` has no `enastro.config.json`, so
  // the config-level default of "wikilink" applies, ADR-0016).
  await page.evaluate(() => {
    localStorage.removeItem("enastro:particle-direction:v1");
  });
});

describe("browser E2E: graph particle direction toggle (REQ-UX-012)", () => {
  it("defaults to 'wikilink', with the particle departing from the referencing note (note-a) toward the referenced note (note-b)", async () => {
    await page.goto(`${baseUrl}/graph/`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");

    expect(
      await page.evaluate(() => (globalThis as any).window.__enastroGraph.getParticleDirection()),
    ).toBe("wikilink");
    expect(
      await page.evaluate(() =>
        (globalThis as any).window.__enastroGraph.getParticleFromId("note-a", "note-b"),
      ),
    ).toBe("note-a");
  });

  it("toggles to 'backlink', persists the choice, and flips the particle's departure node", async () => {
    await page.goto(`${baseUrl}/graph/`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");

    const toggle = page.locator("#particle-direction-toggle");
    await expect.poll(() => toggle.isVisible()).toBe(true);
    expect(await toggle.getAttribute("aria-pressed")).toBe("false");

    await toggle.click();

    expect(await toggle.getAttribute("aria-pressed")).toBe("true");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("enastro:particle-direction:v1")))
      .toBe("backlink");
    expect(
      await page.evaluate(() => (globalThis as any).window.__enastroGraph.getParticleDirection()),
    ).toBe("backlink");
    expect(
      await page.evaluate(() =>
        (globalThis as any).window.__enastroGraph.getParticleFromId("note-a", "note-b"),
      ),
    ).toBe("note-b");

    await page.reload();
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");
    expect(
      await page.evaluate(() => (globalThis as any).window.__enastroGraph.getParticleDirection()),
    ).toBe("backlink");
    expect(await page.locator("#particle-direction-toggle").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not change the graph IR: backlinks/edges stay based on edge.source/edge.target regardless of the toggle", async () => {
    await page.goto(`${baseUrl}/graph/`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");

    const graph = await page.evaluate(() => fetch("../graph.json").then((r) => r.json()));
    const edge = graph.edges.find((e: { source: string; target: string }) => e.source === "note-a" && e.target === "note-b");
    expect(edge).toBeTruthy();

    await page.locator("#particle-direction-toggle").click();
    const graphAfterToggle = await page.evaluate(() => fetch("../graph.json").then((r) => r.json()));
    expect(graphAfterToggle).toEqual(graph);
  });
});
