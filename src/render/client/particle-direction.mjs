/**
 * User-configurable graph particle travel direction (graph.html only).
 *
 * By default (`"backlink"`), each edge's energy particle travels
 * from the *referenced* note (the wikilink target — a dependency) toward
 * the *referencing* note (the wikilink source — its dependent), so the
 * particle's motion matches the direction ideas are built up in: from
 * foundations toward what depends on them. The alternative
 * (`"wikilink"`) instead follows the literal wikilink direction
 * (`edge.source` \u2192 `edge.target`, i.e. referencing \u2192 referenced),
 * matching the underlying graph IR (REQ-GRAPH-002/003) exactly.
 *
 * This module only decides *which endpoint of an edge is the particle's
 * visual departure point*; it never changes `edge.source`/`edge.target`
 * themselves, backlinks, or any other graph-IR semantics — those stay
 * exactly as built (`src/graph/build.ts`, `src/graph/backlinks.ts`).
 *
 * Entirely client-side, following the same `localStorage`-only pattern as
 * the theme switcher (REQ-UX-011) and exploration status (ADR-0014): the
 * build never bakes in a specific direction (beyond an optional vault-level
 * default from `enastro.config.json`'s `defaultParticleDirection`, ADR-0016),
 * and the choice is never written to any build artifact.
 */

export const STORAGE_KEY = "enastro:particle-direction:v1";

export const DEFAULT_DIRECTION = "wikilink";

const VALID_DIRECTIONS = ["backlink", "wikilink"];

/** @param {string} value */
export function isValidDirection(value) {
  return VALID_DIRECTIONS.includes(value);
}

/** Reads the persisted direction choice from localStorage, if any and valid. */
export function readStoredDirection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && isValidDirection(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persists a direction choice to localStorage.
 * @param {string} direction
 * @returns {boolean} whether the write succeeded (false e.g. on a
 *   QuotaExceededError — the caller may still apply the choice for the
 *   current page view, it just won't survive a reload).
 */
export function storeDirection(direction) {
  try {
    localStorage.setItem(STORAGE_KEY, direction);
    return true;
  } catch {
    return false;
  }
}

/**
 * Given an edge's `source`/`target` (referencing/referenced) endpoints and
 * the active direction setting, returns which one is the particle's visual
 * departure (`from`) and arrival (`to`) point. Pure/generic over any object
 * shape (used with graph nodes in graph-view.mjs, and with plain
 * `{ id }` fixtures in tests).
 * @template T
 * @param {string} direction
 * @param {T} source
 * @param {T} target
 * @returns {{ from: T, to: T }}
 */
export function resolveParticleEndpoints(direction, source, target) {
  return direction === "wikilink" ? { from: source, to: target } : { from: target, to: source };
}
