import { splitCodeSegments } from "../parser/code-blocks.js";
import { INLINE_TAG_PATTERN } from "../parser/tags.js";

/**
 * Hyperlinks inline `#tag` occurrences in a note body so that clicking one
 * jumps to the index page pre-filtered by that tag, mirroring the frontmatter
 * tag list already rendered near the note id (REQ-UX-008).
 *
 * Uses the exact same pattern as `parser/tags.ts`'s `extractInlineTags` so
 * the set of hyperlinked occurrences always matches the set of extracted
 * tags. Code spans/fences are left untouched (same convention as
 * `substituteLinks`).
 */
export function substituteInlineTags(body: string): string {
  return splitCodeSegments(body)
    .map((segment) => {
      if (segment.code) {
        return segment.text;
      }

      return segment.text.replace(INLINE_TAG_PATTERN, (_match, prefix: string, tag: string) => {
        return `${prefix}[#${tag}](../index.html?tags=${encodeURIComponent(tag)})`;
      });
    })
    .join("");
}
