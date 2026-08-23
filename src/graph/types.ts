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
  /** The document body (frontmatter removed), used by the render stage. */
  body: string;
  /**
   * Last-modified time (epoch ms, from `fs.Stat.mtime`), threaded from
   * `VaultFile.modifiedAt`. Deliberately not carried into `PublicNode`/
   * `graph.json` (whose schema is a closed whitelist, see
   * `validate-graph-schema.ts`) — it is only used to render/search a note's
   * last-modified timestamp (REQ-UX-007), not as part of the public graph
   * artifact contract.
   */
  modifiedAt: number;
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
