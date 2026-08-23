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
