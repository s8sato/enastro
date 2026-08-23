import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildGraph } from "../graph/build.js";
import { computeBacklinks } from "../graph/backlinks.js";
import { buildPublicProjection } from "../projection/build.js";
import type { PublicNode } from "../projection/types.js";
import { renderIndexPage, renderNoteBody, renderNotePage } from "../render/index.js";
import { buildSearchIndexEntry, type SearchIndexEntry } from "./search-index.js";

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
  const graph = buildGraph(vaultDir);
  const { projection, warnings } = buildPublicProjection(graph);

  // Sort nodes/edges for deterministic, reproducible output (REQ-BUILD-001).
  const sortedNodes = [...projection.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...projection.edges].sort((a, b) =>
    a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source),
  );

  const backlinksByTarget = computeBacklinks(sortedEdges);
  const publicNodeById = new Map(sortedNodes.map((node) => [node.id, node]));
  const bodyById = new Map(graph.nodes.map((node) => [node.id, node.body]));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "notes"), { recursive: true });

  const searchEntries: SearchIndexEntry[] = [];

  for (const node of sortedNodes) {
    const body = bodyById.get(node.id) ?? "";
    const { html: bodyHtml } = renderNoteBody(body, graph);

    const backlinkNodes = [
      ...new Map(
        (backlinksByTarget.get(node.id) ?? [])
          .map((edge) => publicNodeById.get(edge.source))
          .filter((n): n is PublicNode => n !== undefined)
          .map((n) => [n.id, n] as const),
      ).values(),
    ].sort((a, b) => a.id.localeCompare(b.id));

    const page = renderNotePage({ node, bodyHtml, backlinks: backlinkNodes });
    const notePath = path.join(outDir, "notes", `${node.id}.html`);
    mkdirSync(path.dirname(notePath), { recursive: true });
    writeFileSync(notePath, page, "utf-8");

    searchEntries.push(buildSearchIndexEntry(node, bodyHtml));
  }

  writeFileSync(path.join(outDir, "index.html"), renderIndexPage(sortedNodes), "utf-8");
  writeFileSync(
    path.join(outDir, "graph.json"),
    JSON.stringify({ nodes: sortedNodes, edges: sortedEdges }, null, 2),
    "utf-8",
  );
  writeFileSync(path.join(outDir, "search-index.json"), JSON.stringify(searchEntries, null, 2), "utf-8");

  return { warnings };
}
