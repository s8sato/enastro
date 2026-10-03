import { describe, expect, it } from "vitest";
import { buildHighlightHash, findMatchRanges, parseHighlightHash } from "./highlight.mjs";

describe("buildHighlightHash / parseHighlightHash (REQ-UX-019)", () => {
  it("round-trips a multi-word query into lowercased terms", () => {
    const hash = buildHighlightHash("  Note LINKS ");
    expect(hash).toBe("#hl=Note%20LINKS");
    expect(parseHighlightHash(hash)).toEqual(["note", "links"]);
  });

  it("round-trips non-ASCII and URL-special characters", () => {
    expect(parseHighlightHash(buildHighlightHash("表示名 a&b=c #x +y"))).toEqual(["表示名", "a&b=c", "#x", "+y"]);
  });

  it("returns an empty hash for an empty or whitespace-only query", () => {
    expect(buildHighlightHash("")).toBe("");
    expect(buildHighlightHash("   ")).toBe("");
  });

  it("returns no terms when the fragment has no hl parameter", () => {
    expect(parseHighlightHash("")).toEqual([]);
    expect(parseHighlightHash("#")).toEqual([]);
    expect(parseHighlightHash("#some-heading")).toEqual([]);
    expect(parseHighlightHash("#hl=")).toEqual([]);
  });

  it("does not throw on malformed percent-encoding", () => {
    expect(() => parseHighlightHash("#hl=%E0%A4%A")).not.toThrow();
  });
});

describe("findMatchRanges (REQ-UX-019)", () => {
  it("finds every case-insensitive occurrence of each term", () => {
    expect(findMatchRanges("Note: this note links", ["note", "links"])).toEqual([
      { start: 0, end: 4 },
      { start: 11, end: 15 },
      { start: 16, end: 21 },
    ]);
  });

  it("matches non-ASCII text by substring", () => {
    expect(findMatchRanges("[[note-b|表示名]] へのリンク", ["表示"])).toEqual([{ start: 9, end: 11 }]);
  });

  it("treats RegExp metacharacters literally", () => {
    expect(findMatchRanges("f(x) = a.*b", ["(", ".*"])).toEqual([
      { start: 1, end: 2 },
      { start: 8, end: 10 },
    ]);
    expect(findMatchRanges("abc", [".*"])).toEqual([]);
  });

  it("merges overlapping, nested, and adjacent occurrences", () => {
    expect(findMatchRanges("note-a", ["note", "note-a", "e-a"])).toEqual([{ start: 0, end: 6 }]);
    expect(findMatchRanges("aaa", ["aa"])).toEqual([{ start: 0, end: 3 }]);
    expect(findMatchRanges("abcd", ["ab", "cd"])).toEqual([{ start: 0, end: 4 }]);
  });

  it("maps offsets back correctly when lowercasing changes a character's length", () => {
    // "İ".toLowerCase() is two code units long.
    expect(findMatchRanges("İx note", ["note"])).toEqual([{ start: 3, end: 7 }]);
  });

  it("returns no ranges for no terms or empty terms", () => {
    expect(findMatchRanges("anything", [])).toEqual([]);
    expect(findMatchRanges("anything", [""])).toEqual([]);
  });
});
