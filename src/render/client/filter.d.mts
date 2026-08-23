export interface SearchIndexEntryLike {
  id: string;
  title: string;
  tags: string[];
  text: string;
}

export function filterEntries(
  entries: SearchIndexEntryLike[],
  query: string,
  selectedTags: string[],
): string[];
