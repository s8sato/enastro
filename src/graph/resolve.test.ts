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
    body: overrides.body ?? "",
  };
}

describe("resolveTarget", () => {
  it("resolves an exact id match", () => {
    const index = buildResolutionIndex([node({ id: "note-b", title: "Note B" })]);
    expect(resolveTarget("note-b", index)).toEqual({ status: "resolved", nodeId: "note-b" });
  });

  it("resolves an alias match when there is no id match", () => {
    const index = buildResolutionIndex([node({ id: "note-x", title: "Note X", aliases: ["nx"] })]);
    expect(resolveTarget("nx", index)).toEqual({ status: "resolved", nodeId: "note-x" });
  });

  it("prefers an id match over a colliding alias match (ADR-0009)", () => {
    const index = buildResolutionIndex([
      node({ id: "note-b", title: "Note B" }),
      node({ id: "note-c-alias", title: "Note C Alias", aliases: ["note-b"] }),
    ]);
    expect(resolveTarget("note-b", index)).toEqual({ status: "resolved", nodeId: "note-b" });
  });

  it("returns unresolved for a broken link without throwing (REQ-CONTENT-007)", () => {
    const index = buildResolutionIndex([node({ id: "note-a", title: "Note A" })]);
    expect(resolveTarget("does-not-exist", index)).toEqual({ status: "unresolved" });
  });

  it("returns ambiguous-alias when the same alias is declared by multiple notes", () => {
    const index = buildResolutionIndex([
      node({ id: "note-x", title: "Note X", aliases: ["shared"] }),
      node({ id: "note-y", title: "Note Y", aliases: ["shared"] }),
    ]);
    const result = resolveTarget("shared", index);
    expect(result.status).toBe("ambiguous-alias");
  });
});
