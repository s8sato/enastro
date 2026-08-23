import { stripCode } from "./code-blocks.js";

/**
 * Matches inline `#tag` occurrences (REQ-CONTENT-003). The tag must be
 * preceded by whitespace, an opening bracket/paren, or the start of the
 * text, and must not be immediately followed by whitespace (which
 * distinguishes it from an ATX heading marker like `# Heading`).
 *
 * Exported so `render/substitute-tags.ts` can reuse the exact same pattern
 * when hyperlinking inline tags in the rendered note body (REQ-UX-008).
 */
export const INLINE_TAG_PATTERN = /(^|[\s([])#([\p{L}\p{N}_/-]+)/gu;

/**
 * Extracts inline `#tag` occurrences from a document body (frontmatter
 * `tags:` are handled separately by the frontmatter parser).
 */
export function extractInlineTags(body: string): string[] {
  const withoutCode = stripCode(body);
  const tags: string[] = [];

  for (const match of withoutCode.matchAll(INLINE_TAG_PATTERN)) {
    const tag = match[2];
    if (tag) {
      tags.push(tag);
    }
  }

  return tags;
}
