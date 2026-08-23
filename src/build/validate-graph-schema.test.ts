import { describe, expect, it } from "vitest";
import { validateGraphSchema } from "./validate-graph-schema.js";

describe("validateGraphSchema", () => {
  it("accepts a well-formed graph", () => {
    const result = validateGraphSchema({
      nodes: [{ id: "a", title: "A", tags: ["x"], x: 1.5, y: -2 }],
      edges: [{ source: "a", target: "a", kind: "wikilink" }],
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects a non-object root", () => {
    expect(validateGraphSchema(null).valid).toBe(false);
    expect(validateGraphSchema("nope").valid).toBe(false);
  });

  it("rejects nodes missing required fields or with unexpected fields", () => {
    const result = validateGraphSchema({
      nodes: [{ id: "a", tags: ["x"], path: "/leaked", x: 0, y: 0 }],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("nodes[0].title must be a string");
    expect(result.errors).toContain('nodes[0] has unexpected field "path"');
  });

  it("rejects nodes with missing or non-finite x/y layout coordinates", () => {
    const result = validateGraphSchema({
      nodes: [{ id: "a", title: "A", tags: [], y: Number.NaN }],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("nodes[0].x must be a finite number");
    expect(result.errors).toContain("nodes[0].y must be a finite number");
  });

  it("rejects edges with an invalid kind", () => {
    const result = validateGraphSchema({
      nodes: [],
      edges: [{ source: "a", target: "b", kind: "hyperlink" }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('edges[0].kind must be "wikilink" or "embed"');
  });
});
