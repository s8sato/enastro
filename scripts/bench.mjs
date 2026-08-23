#!/usr/bin/env node
/**
 * Performance harness (REQ-PERF-001, ADR-0012). Measures, against
 * `fixtures/benchmark-vault/vault` (10k published notes / ~50k edges,
 * generated via `npm run generate:benchmark-vault`):
 *
 *   1. `enastro build` wall-clock time.
 *   2. graph.html's "first interactive frame" (ADR-0012's operational
 *      definition: the first `requestAnimationFrame` after the precomputed
 *      layout paints — signalled by `graph-view.mjs` setting
 *      `document.body.dataset.graphInteractive = "true"`).
 *   3. index.html's tag-filter latency (one AND-tag toggle -> DOM update).
 *   4. graph.html pan/zoom FPS, sampled over a simulated 1s drag gesture
 *      (reported, not gated — REQ-PERF-001/spec/07-performance.md §2).
 *
 * Each metric is sampled `RUNS` times; p50 and max are reported (not p95/p99,
 * per ADR-0012's reference-environment methodology: Playwright/headless
 * Chromium on GitHub Actions `ubuntu-latest`).
 *
 * This script only measures — it deliberately does not attempt to fix any
 * gap it finds (LOOP.md safety rule: report gaps to the user rather than
 * silently tuning scope down).
 *
 * Requires a one-time `npx playwright install chromium` (already done by CI,
 * see .github/workflows/ci.yml).
 */
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BENCHMARK_VAULT_DIR = path.join(ROOT_DIR, "fixtures", "benchmark-vault", "vault");
const ENASTRO_BIN = path.join(ROOT_DIR, "bin", "enastro.mjs");
const RUNS = 10;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

/** Minimal static file server (mirrors src/e2e/static-server.ts; duplicated
 * here so this script stays runnable standalone, without depending on
 * `dist-ts/` having been built). */
function serveStatic(rootDir) {
  const server = createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const filePath = path.join(rootDir, requestPath);

    if (!filePath.startsWith(rootDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function report(label, samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  console.log(`  ${label}: p50=${p50.toFixed(1)}  max=${max.toFixed(1)}  (n=${samplesMs.length}, unit=ms unless noted)`);
  return { p50, max };
}

function measureBuildTime() {
  if (!existsSync(BENCHMARK_VAULT_DIR)) {
    console.error(
      `Benchmark vault not found at ${BENCHMARK_VAULT_DIR}.\n` +
        "Run `npm run generate:benchmark-vault` first.",
    );
    process.exit(1);
  }

  console.log(`\nBuilding fixtures/benchmark-vault/vault ${RUNS} times...`);
  const samples = [];
  let keptOutDir;
  for (let i = 0; i < RUNS; i++) {
    const outDir = mkdtempSync(path.join(tmpdir(), "enastro-bench-"));
    const start = performance.now();
    execFileSync(process.execPath, [ENASTRO_BIN, BENCHMARK_VAULT_DIR, outDir], { stdio: "ignore" });
    samples.push(performance.now() - start);

    if (i === RUNS - 1) {
      keptOutDir = outDir; // reused for the browser-side measurements below
    } else {
      rmSync(outDir, { recursive: true, force: true });
    }
  }

  report("build time (10k notes / ~50k edges)", samples);
  return keptOutDir;
}

async function measureFirstInteractiveFrame(browser, baseUrl) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await browser.newPage();
    const start = performance.now();
    await page.goto(`${baseUrl}/graph.html`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body.dataset.graphInteractive === "true", {
      timeout: 30_000,
    });
    samples.push(performance.now() - start);
    await page.close();
  }
  report("graph.html first interactive frame", samples);
}

async function measureTagFilterLatency(browser, baseUrl) {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/index.html`);
  await page.waitForSelector("#tag-filters input");

  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const latency = await page.evaluate(async () => {
      const checkbox = document.querySelector("#tag-filters input");
      if (!checkbox) return Number.NaN;
      const start = performance.now();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return performance.now() - start;
    });
    samples.push(latency);
  }
  await page.close();
  report("index.html tag filter latency", samples);
}

async function measurePanZoomFps(browser, baseUrl) {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/graph.html`);
  await page.waitForFunction(() => document.body.dataset.graphInteractive === "true", { timeout: 30_000 });

  const fps = await page.evaluate(async () => {
    const canvas = document.querySelector("#graph-canvas-container canvas");
    const rect = canvas.getBoundingClientRect();

    function dispatchPointer(type, x, y) {
      canvas.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true }),
      );
    }

    let frames = 0;
    let running = true;
    function countFrame() {
      frames++;
      if (running) requestAnimationFrame(countFrame);
    }
    requestAnimationFrame(countFrame);

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const durationMs = 1000;
    const start = performance.now();
    dispatchPointer("pointerdown", cx, cy);
    while (performance.now() - start < durationMs) {
      const t = (performance.now() - start) / durationMs;
      dispatchPointer("pointermove", cx + Math.sin(t * 10) * 100, cy + Math.cos(t * 10) * 100);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    dispatchPointer("pointerup", cx, cy);
    running = false;

    return frames / (durationMs / 1000);
  });

  await page.close();
  console.log(`  graph.html pan/zoom FPS (sampled, not gated): ${fps.toFixed(1)} fps`);
}

async function main() {
  console.log(`enastro perf harness (REQ-PERF-001, ADR-0012) — ${RUNS} runs, reporting p50/max`);

  const outDir = measureBuildTime();
  const { server, baseUrl } = await serveStatic(outDir);
  const browser = await chromium.launch();

  try {
    console.log("\nMeasuring graph.html / index.html metrics in headless Chromium...");
    await measureFirstInteractiveFrame(browser, baseUrl);
    await measureTagFilterLatency(browser, baseUrl);
    await measurePanZoomFps(browser, baseUrl);
  } finally {
    await browser.close();
    server.close();
    rmSync(outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
