import type { EdgeKind, GraphEdge } from "../graph/types.js";

/**
 * A node in the public projection. Deliberately omits `path`, `aliases`, and
 * `publish` — the public artifact contract (spec/05-artifact-contracts.md
 * §3) only exposes `id`, `title`, and `tags` for published notes
 * (REQ-SEC-001: no private note's path/alias may ever be exposed, and no
 * unpublished node should carry redundant fields into public output).
 */
export interface PublicNode {
  id: string;
  title: string;
  tags: string[];
}

/** An edge between two published nodes. Same shape as {@link GraphEdge}. */
export type PublicEdge = GraphEdge;

/** The public projection: only publish:true nodes and edges between them. */
export interface PublicProjection {
  nodes: PublicNode[];
  edges: PublicEdge[];
}

export interface ProjectionResult {
  projection: PublicProjection;
  /**
   * Human-readable notes about edges removed because they pointed to an
   * unpublished note (REQ-PUB-004). These MUST only ever reach a private
   * build log (e.g. CLI stdout, .enastro/build.log) — never `dist/` or any
   * other public artifact. It is safe for these strings to name the private
   * note, since only the author is expected to read them.
   */
  warnings: string[];
}

export type { EdgeKind };
