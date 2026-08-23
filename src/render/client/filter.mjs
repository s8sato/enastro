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
  const normalizedQuery = query.trim().toLowerCase();

  return entries
    .filter((entry) => {
      const matchesQuery =
        normalizedQuery === "" ||
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.text.toLowerCase().includes(normalizedQuery);
      const matchesTags = selectedTags.every((tag) => entry.tags.includes(tag));
      return matchesQuery && matchesTags;
    })
    .map((entry) => entry.id);
}
