import { discoverVault } from "../vault/discover.js";
import { parseDocument } from "../parser/index.js";
import { buildResolutionIndex, resolveTarget } from "./resolve.js";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "./types.js";

/**
 * Builds the full (unfiltered) Knowledge Graph IR from a vault directory
 * (REQ-GRAPH-001). This is the "local projection" equivalent — no
 * publish-based filtering is applied (that is a later projection stage, see
 * spec/04-architecture.md §1).
 */
export function buildGraph(vaultDir: string): KnowledgeGraph {
  const files = discoverVault(vaultDir);

  const parsedFiles = files.map((file) => ({
    file,
    parsed: parseDocument(file.raw),
  }));

  const nodes: GraphNode[] = parsedFiles.map(({ file, parsed }) => ({
    id: file.id,
    title: (parsed.frontmatter.title ?? file.id).normalize("NFC"),
    aliases: parsed.frontmatter.aliases,
    tags: [...parsed.frontmatter.tags, ...parsed.inlineTags],
    publish: parsed.frontmatter.publish,
    path: file.filePath,
    body: parsed.body,
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

  return { nodes, edges };
}
