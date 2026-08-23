import type { GraphEdge, KnowledgeGraph } from "../graph/types.js";
import type { ProjectionResult } from "./types.js";

/**
 * Builds the public projection from the full Knowledge Graph IR
 * (REQ-PUB-002): only `publish: true` nodes are retained (REQ-PUB-001), and
 * edges pointing to (or originating from, transitively via source removal)
 * an unpublished node are removed entirely (REQ-PUB-003, REQ-PUB-005).
 *
 * This is the privacy invariant boundary (REQ-SEC-001): no unpublished
 * node's id/title/tags/aliases/path may cross into the returned
 * {@link PublicProjection}.
 */
export function buildPublicProjection(graph: KnowledgeGraph): ProjectionResult {
  const publicIds = new Set(graph.nodes.filter((node) => node.publish).map((node) => node.id));

  const nodes = graph.nodes
    .filter((node) => publicIds.has(node.id))
    .map((node) => ({ id: node.id, title: node.title, tags: node.tags }));

  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  for (const edge of graph.edges) {
    if (!publicIds.has(edge.source)) {
      // The source note itself is not published, so its outbound links are
      // not part of the public graph at all (nothing to warn about here).
      continue;
    }

    if (!publicIds.has(edge.target)) {
      warnings.push(
        `removed ${edge.kind} edge from published note "${edge.source}" to unpublished note "${edge.target}" (REQ-PUB-003/REQ-PUB-005)`,
      );
      continue;
    }

    edges.push(edge);
  }

  return { projection: { nodes, edges }, warnings };
}
