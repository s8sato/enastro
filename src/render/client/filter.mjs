/**
 * Pure filtering logic for the client-side search & tag filter UI
 * (REQ-UX-001, REQ-UX-002). No DOM/browser APIs are used here, so this
 * module can be imported directly both from the browser (via search.mjs)
 * and from Node (via vitest unit tests), without any build step.
 *
 * Tag matching is AND semantics: a note must have every selected tag to
 * be considered a match.
 */

/**
 * @param {{id: string, title: string, tags: string[], text: string}[]} entries
 * @param {string} query
 * @param {string[]} selectedTags
 * @returns {string[]} ids of entries that match both the query and the
 *   selected tags.
 */
export function filterEntries(entries, query, selectedTags) {
  // The query is split on whitespace into individual terms, each of which
  // must appear *somewhere* in the entry (AND semantics, mirroring the tag
  // checkboxes below) rather than requiring the whole query to appear as
  // one contiguous substring. This lets queries like "note-a example" or
  // "This links" match a note whose id/title/tags/text collectively (but
  // not contiguously) contain those terms.
  const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return entries
    .filter((entry) => {
      const haystack = [entry.id, entry.title, ...entry.tags, entry.text].join(" ").toLowerCase();
      const matchesQuery = queryTerms.every((term) => haystack.includes(term));
      const matchesTags = selectedTags.every((tag) => entry.tags.includes(tag));
      return matchesQuery && matchesTags;
    })
    .map((entry) => entry.id);
}
