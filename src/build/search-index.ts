export interface SearchIndexEntry {
  id: string;
  title: string;
  tags: string[];
  text: string;
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
): SearchIndexEntry {
  return {
    id: node.id,
    title: node.title,
    tags: node.tags,
    text: stripHtmlTags(bodyHtml),
  };
}
