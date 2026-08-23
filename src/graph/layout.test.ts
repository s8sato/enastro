import { describe, expect, it } from "vitest";
import { computeGraphLayout } from "./layout.js";

describe("computeGraphLayout", () => {
  it("returns an empty map for an empty graph", () => {
    const positions = computeGraphLayout([], []);
    expect(positions.size).toBe(0);
  });

  it("assigns every node a finite (x, y) position", () => {
    const nodes = [
      { id: "a", title: "A", tags: [] },
      { id: "b", title: "B", tags: [] },
      { id: "c", title: "C", tags: [] },
    ];
    const edges = [
      { source: "a", target: "b", kind: "wikilink" as const },
      { source: "b", target: "c", kind: "wikilink" as const },
    ];

    const positions = computeGraphLayout(nodes, edges);

    expect(positions.size).toBe(3);
    for (const id of ["a", "b", "c"]) {
      const pos = positions.get(id);
      expect(pos).toBeDefined();
      expect(Number.isFinite(pos?.x)).toBe(true);
      expect(Number.isFinite(pos?.y)).toBe(true);
    }
  });

  it("is deterministic across repeated calls given the same input (REQ-BUILD-001)", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, title: `N${i}`, tags: [] }));
    const edges = Array.from({ length: 30 }, (_, i) => ({
      source: `n${i % 20}`,
      target: `n${(i * 7 + 1) % 20}`,
      kind: "wikilink" as const,
    }));

    const first = computeGraphLayout(nodes, edges);
    const second = computeGraphLayout(nodes, edges);

    for (const node of nodes) {
      expect(second.get(node.id)).toEqual(first.get(node.id));
    }
  });

  it("does not collapse every node to the same position", () => {
    const nodes = [
      { id: "a", title: "A", tags: [] },
      { id: "b", title: "B", tags: [] },
    ];
    const edges = [{ source: "a", target: "b", kind: "wikilink" as const }];

    const positions = computeGraphLayout(nodes, edges);
    const a = positions.get("a")!;
    const b = positions.get("b")!;
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
  });
});
