import type { GraphNode } from "./types.js";

export interface ResolutionIndex {
  /** normalized id -> node id (ids are already unique across the vault, see src/vault/discover.ts). */
  idIndex: Map<string, string>;
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

/** Builds id/alias lookup indexes from a node list. */
export function buildResolutionIndex(nodes: GraphNode[]): ResolutionIndex {
  const idIndex = new Map<string, string>();
  const aliasIndex = new Map<string, string[]>();

  for (const node of nodes) {
    idIndex.set(normalize(node.id), node.id);

    for (const alias of node.aliases) {
      const key = normalize(alias);
      const existing = aliasIndex.get(key) ?? [];
      existing.push(node.id);
      aliasIndex.set(key, existing);
    }
  }

  return { idIndex, aliasIndex };
}

/**
 * Resolves a wikilink/embed target string to a node id.
 *
 * Id matches take priority over alias matches (ADR-0009). This mirrors how
 * Obsidian itself resolves `[[target]]`: always against the file's own
 * name/id (plus `aliases:`), never against a separate "display title"
 * concept. If the target matches no id and collides between multiple
 * notes' aliases, resolution is left ambiguous (OPEN, not yet decided)
 * rather than guessing. If the target matches nothing at all, it is a
 * broken link (REQ-CONTENT-007) and must not fail the build — callers are
 * expected to simply omit the edge.
 */
export function resolveTarget(target: string, index: ResolutionIndex): ResolutionResult {
  const key = normalize(target);

  const idMatch = index.idIndex.get(key);
  if (idMatch) {
    return { status: "resolved", nodeId: idMatch };
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
