import { parseFrontmatter } from "./frontmatter.js";
import { extractWikilinks } from "./wikilink.js";
import { extractInlineTags } from "./tags.js";
import type { ParsedDocument } from "./types.js";

export * from "./types.js";

/**
 * Parses a single Markdown document (frontmatter + body) into a
 * {@link ParsedDocument}. This is a pure syntax-level extraction step:
 * resolving wikilink targets against other notes, alias collisions
 * (REQ-CONTENT-006), backlinks, and publish selection are Graph IR concerns
 * handled by later pipeline stages (spec/04-architecture.md).
 */
export function parseDocument(raw: string): ParsedDocument {
  const { frontmatter, body } = parseFrontmatter(raw);

  return {
    frontmatter,
    links: extractWikilinks(body),
    inlineTags: extractInlineTags(body),
    body,
  };
}
