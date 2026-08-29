import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../build/site.js";
import { serveStatic } from "./static-server.js";

const basicVaultDir = path.resolve(fileURLToPath(import.meta.url), "../../../fixtures/basic-vault");

let vaultDir: string;
let outDir: string;
let server: Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-site-config-vault-"));
  cpSync(basicVaultDir, vaultDir, { recursive: true });
  writeFileSync(
    path.join(vaultDir, "enastro.config.json"),
    JSON.stringify({
      siteTitle: "My Garden",
      defaultTheme: "nova",
      defaultParticleDirection: "backlink",
    }),
    "utf-8",
  );

  outDir = mkdtempSync(path.join(tmpdir(), "enastro-site-config-e2e-"));
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
  if (vaultDir) {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

afterEach(async () => {
  await page.evaluate(() => {
    localStorage.removeItem("enastro:theme:v1");
    localStorage.removeItem("enastro:particle-direction:v1");
  });
});

describe("browser E2E: enastro.config.json build-time site defaults (ADR-0016)", () => {
  it("applies siteTitle to the All Notes page's <title> and <h1>", async () => {
    await page.goto(`${baseUrl}/`);
    expect(await page.title()).toBe("My Garden");
    expect(await page.locator("h1").first().textContent()).toBe("My Garden");
  });

  it("applies siteTitle to the graph page's <title>", async () => {
    await page.goto(`${baseUrl}/graph/`);
    expect(await page.title()).toBe("My Garden · Graph view");
  });

  it("applies defaultTheme on first visit with no stored preference", async () => {
    await page.goto(`${baseUrl}/`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("nova");
  });

  it("applies defaultParticleDirection on first visit with no stored preference", async () => {
    await page.goto(`${baseUrl}/graph/`);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).document.body.dataset.graphInteractive))
      .toBe("true");
    expect(
      await page.evaluate(() => (globalThis as any).window.__enastroGraph.getParticleDirection()),
    ).toBe("backlink");
  });
});
