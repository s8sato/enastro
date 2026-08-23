import { describe, expect, it } from "vitest";
import { buildResolutionIndex, resolveTarget } from "./resolve.js";
import type { GraphNode } from "./types.js";

function node(overrides: Partial<GraphNode>): GraphNode {
  return {
    id: overrides.id ?? "id",
    title: overrides.title ?? "title",
    aliases: overrides.aliases ?? [],
    tags: overrides.tags ?? [],
    publish: overrides.publish ?? true,
    path: overrides.path ?? "/path",
  };
}

describe("resolveTarget", () => {
  it("resolves an exact title match", () => {
    const index = buildResolutionIndex([node({ id: "note-b", title: "note-b" })]);
    expect(resolveTarget("note-b", index)).toEqual({ status: "resolved", nodeId: "note-b" });
  });

  it("resolves an alias match when there is no title match", () => {
    const index = buildResolutionIndex([node({ id: "note-x", title: "note-x", aliases: ["nx"] })]);
    expect(resolveTarget("nx", index)).toEqual({ status: "resolved", nodeId: "note-x" });
  });

  it("prefers a title match over a colliding alias match (REQ-CONTENT-006, candidate A)", () => {
    const index = buildResolutionIndex([
      node({ id: "note-b", title: "note-b" }),
      node({ id: "note-c-alias", title: "note-c-alias", aliases: ["note-b"] }),
    ]);
    expect(resolveTarget("note-b", index)).toEqual({ status: "resolved", nodeId: "note-b" });
  });

  it("returns unresolved for a broken link without throwing (REQ-CONTENT-007)", () => {
    const index = buildResolutionIndex([node({ id: "note-a", title: "note-a" })]);
    expect(resolveTarget("does-not-exist", index)).toEqual({ status: "unresolved" });
  });

  it("returns ambiguous-alias when the same alias is declared by multiple notes", () => {
    const index = buildResolutionIndex([
      node({ id: "note-x", title: "note-x", aliases: ["shared"] }),
      node({ id: "note-y", title: "note-y", aliases: ["shared"] }),
    ]);
    const result = resolveTarget("shared", index);
    expect(result.status).toBe("ambiguous-alias");
  });
});
