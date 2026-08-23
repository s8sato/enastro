import type { GraphNode } from "./types.js";

export interface ResolutionIndex {
  /** normalized title -> node id (at most one node per title). */
  titleIndex: Map<string, string>;
  /** normalized alias -> node ids (may collide across notes). */
  aliasIndex: Map<string, string[]>;
}

export type ResolutionResult =
  | { status: "resolved"; nodeId: string }
  | { status: "ambiguous-alias"; candidates: string[] }
  | { status: "unresolved" };

function normalize(value: string): string {
  return value.normalize("NFC");
}

/** Builds title/alias lookup indexes from a node list. */
export function buildResolutionIndex(nodes: GraphNode[]): ResolutionIndex {
  const titleIndex = new Map<string, string>();
  const aliasIndex = new Map<string, string[]>();

  for (const node of nodes) {
    titleIndex.set(normalize(node.title), node.id);

    for (const alias of node.aliases) {
      const key = normalize(alias);
      const existing = aliasIndex.get(key) ?? [];
      existing.push(node.id);
      aliasIndex.set(key, existing);
    }
  }

  return { titleIndex, aliasIndex };
}

/**
 * Resolves a wikilink/embed target string to a node id.
 *
 * Title matches take priority over alias matches (REQ-CONTENT-006, candidate
 * A, spec/02-content-semantics.md §2.2). If the target matches no title and
 * collides between multiple notes' aliases, resolution is left ambiguous
 * (OPEN, not yet decided) rather than guessing. If the target matches
 * nothing at all, it is a broken link (REQ-CONTENT-007) and must not fail
 * the build — callers are expected to simply omit the edge.
 */
export function resolveTarget(target: string, index: ResolutionIndex): ResolutionResult {
  const key = normalize(target);

  const titleMatch = index.titleIndex.get(key);
  if (titleMatch) {
    return { status: "resolved", nodeId: titleMatch };
  }

  const aliasMatches = index.aliasIndex.get(key);
  if (aliasMatches && aliasMatches.length === 1) {
    return { status: "resolved", nodeId: aliasMatches[0]! };
  }
  if (aliasMatches && aliasMatches.length > 1) {
    return { status: "ambiguous-alias", candidates: aliasMatches };
  }

  return { status: "unresolved" };
}
