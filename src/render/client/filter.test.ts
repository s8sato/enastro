import { describe, expect, it } from "vitest";
import { filterEntries } from "./filter.mjs";

const entries = [
  { id: "a", title: "Apple Pie", tags: ["food", "dessert"], text: "A sweet dessert." },
  { id: "b", title: "Banana Bread", tags: ["food", "bread"], text: "A tasty loaf." },
  { id: "c", title: "Compiler Design", tags: ["tech"], text: "About parsers and codegen." },
  { id: "legacy-filename", title: "Renamed Note", tags: [], text: "Nothing related here." },
];

describe("filterEntries (REQ-UX-001, REQ-UX-002)", () => {
  it("returns all ids when query and tags are both empty", () => {
    expect(filterEntries(entries, "", [])).toEqual(["a", "b", "c", "legacy-filename"]);
  });

  it("matches case-insensitively against title", () => {
    expect(filterEntries(entries, "apple", [])).toEqual(["a"]);
  });

  it("matches case-insensitively against text", () => {
    expect(filterEntries(entries, "PARSERS", [])).toEqual(["c"]);
  });

  it("matches case-insensitively against id even when title/text don't contain the query", () => {
    expect(filterEntries(entries, "LEGACY-FILENAME", [])).toEqual(["legacy-filename"]);
  });

  it("uses AND semantics across multiple selected tags", () => {
    expect(filterEntries(entries, "", ["food"])).toEqual(["a", "b"]);
    expect(filterEntries(entries, "", ["food", "bread"])).toEqual(["b"]);
    expect(filterEntries(entries, "", ["food", "tech"])).toEqual([]);
  });

  it("combines query and tag filters", () => {
    expect(filterEntries(entries, "bread", ["food"])).toEqual(["b"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterEntries(entries, "nonexistent", [])).toEqual([]);
  });
});

// Reproduces a gap observed during manual localhost verification of the
// basic-vault fixture's real search-index.json output (fields captured
// verbatim from an actual build): multi-word queries composed of terms
// that are individually present in a note's id/title/tags/text, but not
// as one contiguous substring, currently fail to match — because
// filterEntries treats the whole query as a single literal substring
// against id/title/text, and never searches tags at all.
describe("filterEntries: multi-word queries and tag text (REQ-UX-001)", () => {
  const realEntries = [
    {
      id: "note-a",
      title: "Note A",
      tags: ["example", "inline-tag"],
      text: "Note A This note links to Note B and also to 表示名 . It also has an inline #inline-tag.",
    },
    {
      id: "note-b",
      title: "Note B",
      tags: [],
      text: "Note B This note is linked from Note A and should receive a backlink from it.",
    },
  ];

  it.each([
    "note-a example 表示名",
    "note-a example",
    "note-a 表示名",
    "example 表示名",
    "example inline-tag",
    "example",
    "This links",
    "Note B",
  ])("matches note-a for the multi-term query %j", (query) => {
    expect(filterEntries(realEntries, query, [])).toContain("note-a");
  });
});
