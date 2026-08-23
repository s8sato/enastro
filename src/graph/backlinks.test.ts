import { describe, expect, it } from "vitest";
import { computeBacklinks } from "./backlinks.js";
import type { GraphEdge } from "./types.js";

describe("computeBacklinks", () => {
  it("groups edges by target", () => {
    const edges: GraphEdge[] = [
      { source: "note-a", target: "note-b", kind: "wikilink" },
      { source: "note-c", target: "note-b", kind: "wikilink" },
      { source: "note-b", target: "note-a", kind: "wikilink" },
    ];

    const backlinks = computeBacklinks(edges);

    expect(backlinks.get("note-b")).toEqual([
      { source: "note-a", target: "note-b", kind: "wikilink" },
      { source: "note-c", target: "note-b", kind: "wikilink" },
    ]);
    expect(backlinks.get("note-a")).toEqual([
      { source: "note-b", target: "note-a", kind: "wikilink" },
    ]);
    expect(backlinks.get("nonexistent")).toBeUndefined();
  });

  it("returns an empty map for no edges", () => {
    expect(computeBacklinks([]).size).toBe(0);
  });
});
