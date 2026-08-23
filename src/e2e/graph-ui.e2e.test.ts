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
  outDir = mkdtempSync(path.join(tmpdir(), "enastro-graph-e2e-"));
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

describe("browser E2E: Graph UI (REQ-GRAPH-004/005, REQ-UX-009/010, ADR-0010)", () => {
  it("renders a canvas and reaches the first-interactive-frame signal without console errors", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(`${baseUrl}/graph.html`);

    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive), {
        timeout: 15_000,
      })
      .toBe("true");

    const canvasCount = await page.locator("#graph-canvas-container canvas").count();
    expect(canvasCount).toBe(1);

    expect(consoleErrors).toEqual([]);
  });

  it("navigates to a note page when a node is clicked", async () => {
    await page.goto(`${baseUrl}/graph.html`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive), {
        timeout: 15_000,
      })
      .toBe("true");

    const graph = await page.evaluate(async () => {
      const response = await (globalThis as any).fetch("graph.json");
      return (await response.json()) as { nodes: Array<{ id: string }> };
    });

    const nodeId = graph.nodes[0]?.id;
    expect(nodeId).toBeDefined();
    if (!nodeId) return;

    const canvas = page.locator("#graph-canvas-container canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const screenPosition = await page.evaluate(
      (id) => (globalThis as any).__enastroGraph.getNodeScreenPosition(id) as { x: number; y: number } | null,
      nodeId,
    );
    expect(screenPosition).not.toBeNull();

    if (box && screenPosition) {
      await page.mouse.click(box.x + screenPosition.x, box.y + screenPosition.y);
    }

    await page.waitForURL(/\/notes\/.*\.html$/, { timeout: 5_000 });
    expect(page.url()).toContain(`/notes/${nodeId}.html`);
  });
});
