import { discoverVault } from "../vault/discover.js";
import { parseDocument } from "../parser/index.js";
import { buildResolutionIndex, resolveTarget } from "./resolve.js";
import { extractFirstH1 } from "./extract-title.js";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "./types.js";

export interface BuildGraphResult {
  graph: KnowledgeGraph;
  /** Human-readable warnings (e.g. an ignored frontmatter `title` field,
   * ADR-0009). Must only ever be surfaced to a private build log/stdout,
   * never written into `dist/` (consistent with REQ-PUB-004's precedent). */
  warnings: string[];
}

/**
 * Builds the full (unfiltered) Knowledge Graph IR from a vault directory
 * (REQ-GRAPH-001). This is the "local projection" equivalent — no
 * publish-based filtering is applied (that is a later projection stage, see
 * spec/04-architecture.md §1).
 */
export function buildGraph(vaultDir: string): BuildGraphResult {
  const files = discoverVault(vaultDir);

  const parsedFiles = files.map((file) => ({
    file,
    parsed: parseDocument(file.raw),
  }));

  const warnings: string[] = [];
  for (const { file, parsed } of parsedFiles) {
    if (parsed.frontmatter.raw.title !== undefined) {
      warnings.push(
        `note "${file.id}": frontmatter "title" is ignored (ADR-0009). The page title is ` +
          `derived from the note's first H1 heading, or its id if the note has no H1.`,
      );
    }
  }

  // Title is derived from the note's own content (ADR-0009), not from
  // frontmatter: the first top-level (H1) heading in the body, falling back
  // to the note's id when there is none. This keeps the title from ever
  // diverging from what a reader actually sees on the page.
  const nodes: GraphNode[] = parsedFiles.map(({ file, parsed }) => ({
    id: file.id,
    title: (extractFirstH1(parsed.body) ?? file.id).normalize("NFC"),
    aliases: parsed.frontmatter.aliases,
    tags: [...parsed.frontmatter.tags, ...parsed.inlineTags],
    publish: parsed.frontmatter.publish,
    path: file.filePath,
    body: parsed.body,
    modifiedAt: file.modifiedAt,
  }));

  const index = buildResolutionIndex(nodes);
  const edges: GraphEdge[] = [];

  for (const { file, parsed } of parsedFiles) {
    for (const link of parsed.links) {
      const result = resolveTarget(link.target, index);
      // Unresolved and ambiguous-alias targets do not produce an edge and
      // must not fail the build (REQ-CONTENT-007).
      if (result.status !== "resolved") {
        continue;
      }
      edges.push({ source: file.id, target: result.nodeId, kind: link.kind });
    }
  }

  return { graph: { nodes, edges }, warnings };
}
