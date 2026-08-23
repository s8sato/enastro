import type { WikilinkRef } from "./types.js";
import { stripCode } from "./code-blocks.js";

/**
 * Matches `[[note]]`, `[[note|alias]]`, and `![[note]]`.
 *
 * The target segment excludes `#`, so heading links (`[[note#heading]]`) and
 * block references (`[[note#^blockid]]`) intentionally do not match and are
 * left untouched as plain text (REQ-CONTENT-005: unsupported OFM syntax must
 * pass through without error, not be misinterpreted).
 */
const WIKILINK_PATTERN = /(!)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extracts wikilinks (REQ-CONTENT-001) and embeds (REQ-CONTENT-002) from a
 * document body. `target` is left unresolved (raw title/alias text as
 * written); resolving it to an actual note is a Graph IR concern.
 */
export function extractWikilinks(body: string): WikilinkRef[] {
  const withoutCode = stripCode(body);
  const refs: WikilinkRef[] = [];

  for (const match of withoutCode.matchAll(WIKILINK_PATTERN)) {
    const [, embedMarker, target, display] = match;
    if (!target) {
      continue;
    }
    refs.push({
      kind: embedMarker ? "embed" : "wikilink",
      target: target.trim(),
      display: display?.trim(),
    });
  }

  return refs;
}
