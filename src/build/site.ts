import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph } from "../graph/build.js";
import { computeBacklinks } from "../graph/backlinks.js";
import { computeGraphLayout } from "../graph/layout.js";
import { buildPublicProjection } from "../projection/build.js";
import type { PublicNode } from "../projection/types.js";
import { renderGraphPage, renderIndexPage, renderNoteBody, renderNotePage } from "../render/index.js";
import { formatTimestamp } from "../render/format-timestamp.js";
import { loadVaultConfig } from "../vault/config.js";
import { discoverAttachments } from "../vault/discover-attachments.js";
import { buildSearchIndexEntry, type SearchIndexEntry } from "./search-index.js";

// Static client-side assets (search.mjs, filter.mjs) for the search/tag
// filter UI (REQ-UX-001, REQ-UX-002). Resolved relative to this module so it
// works whether this runs directly from src/ (tests, via vitest) or from
// dist-ts/ (CLI, after `npm run build` + scripts/copy-client-assets.mjs).
const CLIENT_ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../render/client");
const CLIENT_ASSET_FILENAMES = [
  "filter.mjs",
  "search.mjs",
  "copy-id.mjs",
  "format-local-time.mjs",
  "local-time.mjs",
  "site.css",
  "graph-view.mjs",
  "exploration.mjs",
  "theme-switcher.mjs",
  "particle-direction.mjs",
];

// pixi.js (WebGL renderer, ADR-0010) is vendored as a single self-contained
// ESM bundle rather than added to any bundler pipeline (this project has
// none, by design — REQ-UX-004's portable-static-artifact requirement). Its
// package.json `exports` map doesn't expose `dist/*` subpaths directly, so
// the package root is located via its main entry point instead.
const require = createRequire(import.meta.url);
const PIXI_PACKAGE_ROOT = path.dirname(path.dirname(require.resolve("pixi.js")));
const PIXI_VENDOR_SOURCE_PATH = path.join(PIXI_PACKAGE_ROOT, "dist", "pixi.min.mjs");
const PIXI_VENDOR_FILENAME = "pixi.min.mjs";

export interface BuildSiteResult {
  /** Human-readable warnings (e.g. edges dropped because the target was
   * unpublished). Must only ever be surfaced to a private build log/stdout,
   * never written into `dist/` (REQ-PUB-004). */
  warnings: string[];
}

/**
 * Orchestrates the full "golden path" build: parse vault -> Knowledge Graph
 * IR -> public projection -> render each published note -> write the static
 * artifact (spec/04-architecture.md, spec/05-artifact-contracts.md).
 */
export function buildSite(vaultDir: string, outDir: string): BuildSiteResult {
  const { graph, warnings: titleWarnings } = buildGraph(vaultDir);
  const { projection, warnings: projectionWarnings } = buildPublicProjection(graph);
  const warnings = [...titleWarnings, ...projectionWarnings];

  const config = loadVaultConfig(vaultDir);
  const siteConfig = {
    siteTitle: config.siteTitle,
    defaultTheme: config.defaultTheme,
    defaultParticleDirection: config.defaultParticleDirection,
  };
  const attachments = discoverAttachments(vaultDir);
  const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  // Only allowlisted attachments that actually exist in the vault are
  // published (REQ-PUB-006, REQ-SEC-002, ADR-0003).
  const publishedAttachmentIds = new Set(
    config.publishAttachments.filter((id) => attachmentById.has(id)),
  );

  // Sort nodes/edges for deterministic, reproducible output (REQ-BUILD-001).
  const sortedNodes = [...projection.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...projection.edges].sort((a, b) =>
    a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source),
  );

  const backlinksByTarget = computeBacklinks(sortedEdges);
  const publicNodeById = new Map(sortedNodes.map((node) => [node.id, node]));
  const bodyById = new Map(graph.nodes.map((node) => [node.id, node.body]));
  const modifiedAtById = new Map(graph.nodes.map((node) => [node.id, node.modifiedAt]));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "notes"), { recursive: true });
  mkdirSync(path.join(outDir, "assets"), { recursive: true });

  for (const filename of CLIENT_ASSET_FILENAMES) {
    copyFileSync(path.join(CLIENT_ASSETS_DIR, filename), path.join(outDir, "assets", filename));
  }
  copyFileSync(PIXI_VENDOR_SOURCE_PATH, path.join(outDir, "assets", PIXI_VENDOR_FILENAME));

  for (const attachmentId of [...publishedAttachmentIds].sort()) {
    const attachment = attachmentById.get(attachmentId)!;
    const destPath = path.join(outDir, ...attachmentId.split("/"));
    mkdirSync(path.dirname(destPath), { recursive: true });
    copyFileSync(attachment.filePath, destPath);
  }

  const searchEntries: SearchIndexEntry[] = [];

  for (const node of sortedNodes) {
    const body = bodyById.get(node.id) ?? "";
    const { html: bodyHtml } = renderNoteBody(body, graph, { attachments, publishedAttachmentIds });
    const modifiedAtEpochMs = modifiedAtById.get(node.id) ?? 0;
    // `0` is the "unknown" sentinel (ADR-0015: no git history for this
    // note, mtime is never used as a fallback) — in that case the
    // formatted timestamp is omitted entirely, rather than rendering the
    // UNIX epoch as if it were a real date.
    const modifiedAt = modifiedAtEpochMs > 0 ? formatTimestamp(modifiedAtEpochMs) : undefined;

    const backlinkNodes = [
      ...new Map(
        (backlinksByTarget.get(node.id) ?? [])
          .map((edge) => publicNodeById.get(edge.source))
          .filter((n): n is PublicNode => n !== undefined)
          .map((n) => [n.id, n] as const),
      ).values(),
    ].sort((a, b) => a.id.localeCompare(b.id));

    const page = renderNotePage({ node, bodyHtml, backlinks: backlinkNodes, modifiedAt, modifiedAtEpochMs, siteConfig });
    const notePath = path.join(outDir, "notes", `${node.id}.html`);
    mkdirSync(path.dirname(notePath), { recursive: true });
    writeFileSync(notePath, page, "utf-8");

    searchEntries.push(buildSearchIndexEntry(node, bodyHtml, modifiedAt));
  }

  writeFileSync(path.join(outDir, "index.html"), renderIndexPage(sortedNodes, siteConfig), "utf-8");
  writeFileSync(path.join(outDir, "graph.html"), renderGraphPage(siteConfig), "utf-8");

  // Layout coordinates are precomputed at build time, over the public
  // projection only (REQ-PUB-002), via a deterministic force simulation
  // (ADR-0006, ADR-0010, ADR-0012) so the Graph UI never has to run its own
  // layout pass in the browser.
  const layout = computeGraphLayout(sortedNodes, sortedEdges);
  const graphJsonNodes = sortedNodes.map((node) => {
    const position = layout.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, x: position.x, y: position.y };
  });
  writeFileSync(
    path.join(outDir, "graph.json"),
    JSON.stringify({ nodes: graphJsonNodes, edges: sortedEdges }, null, 2),
    "utf-8",
  );
  writeFileSync(path.join(outDir, "search-index.json"), JSON.stringify(searchEntries, null, 2), "utf-8");

  return { warnings };
}
