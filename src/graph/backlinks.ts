import type { GraphEdge } from "./types.js";

/**
 * Derives backlinks (REQ-GRAPH-003) from a directed edge list: for each node
 * id, the list of edges whose target is that node.
 */
export function computeBacklinks(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const backlinks = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const existing = backlinks.get(edge.target) ?? [];
    existing.push(edge);
    backlinks.set(edge.target, existing);
  }

  return backlinks;
}
