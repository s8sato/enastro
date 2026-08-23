export type EdgeKind = "wikilink" | "embed";

/**
 * A node in the Knowledge Graph IR. This is the *local* (unfiltered) IR —
 * public/private filtering (REQ-PUB-002, REQ-SEC-001) happens in a later
 * projection stage and is out of scope here. In particular, `path` MUST NOT
 * be carried into a public artifact (spec/05-artifact-contracts.md §3).
 */
export interface GraphNode {
  id: string;
  title: string;
  aliases: string[];
  tags: string[];
  publish: boolean;
  path: string;
}

/** A directed edge (REQ-GRAPH-002) produced from a wikilink or embed. */
export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

/** The full (unfiltered) Knowledge Graph IR (REQ-GRAPH-001). */
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
