export interface SearchIndexEntry {
  id: string;
  title: string;
  tags: string[];
  text: string;
  /** Last-modified timestamp, already formatted (REQ-UX-007), e.g.
   * "2026-08-23 12:34 UTC". Included so the search box can match on it. */
  modifiedAt: string;
}

/** Strips HTML tags and collapses whitespace, for plain-text search indexing. */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchIndexEntry(
  node: { id: string; title: string; tags: string[] },
  bodyHtml: string,
  modifiedAt: string,
): SearchIndexEntry {
  return {
    id: node.id,
    title: node.title,
    tags: node.tags,
    text: stripHtmlTags(bodyHtml),
    modifiedAt,
  };
}
