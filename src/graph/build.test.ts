import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./build.js";
import { computeBacklinks } from "./backlinks.js";

const BASIC_VAULT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "basic-vault",
);

describe("buildGraph against fixtures/basic-vault", () => {
  it("discovers the 4 notes plus the fixture README as nodes", () => {
    const { nodes } = buildGraph(BASIC_VAULT_DIR);
    const ids = nodes.map((node) => node.id).sort();
    expect(ids).toEqual([
      "README",
      "note-a",
      "note-b",
      "note-c-alias",
      "note-d-broken-link",
    ]);
  });

  it("creates directed edges for note-a's two links to note-b", () => {
    const { edges } = buildGraph(BASIC_VAULT_DIR);
    const noteAEdges = edges.filter((edge) => edge.source === "note-a");
    expect(noteAEdges).toHaveLength(2);
    expect(noteAEdges.every((edge) => edge.target === "note-b" && edge.kind === "wikilink")).toBe(
      true,
    );
  });

  it("resolves note-c-alias's link to note-b via title match, not its own colliding alias (REQ-CONTENT-006)", () => {
    const { edges } = buildGraph(BASIC_VAULT_DIR);
    const noteCEdges = edges.filter((edge) => edge.source === "note-c-alias");
    expect(noteCEdges).toEqual([{ source: "note-c-alias", target: "note-b", kind: "wikilink" }]);
  });

  it("does not create an edge for a broken link and does not throw (REQ-CONTENT-007)", () => {
    const { edges } = buildGraph(BASIC_VAULT_DIR);
    const noteDEdges = edges.filter((edge) => edge.source === "note-d-broken-link");
    expect(noteDEdges).toEqual([]);
  });

  it("derives backlinks for note-b from note-a and note-c-alias (REQ-GRAPH-003)", () => {
    const { edges } = buildGraph(BASIC_VAULT_DIR);
    const backlinks = computeBacklinks(edges);
    const noteBBacklinkSources = (backlinks.get("note-b") ?? []).map((edge) => edge.source).sort();
    expect(noteBBacklinkSources).toEqual(["note-a", "note-a", "note-c-alias"]);
  });

  it("marks all 4 notes as publish: true, and the frontmatter-less README as publish: false", () => {
    const { nodes } = buildGraph(BASIC_VAULT_DIR);
    const notes = nodes.filter((node) => node.id !== "README");
    expect(notes.every((node) => node.publish)).toBe(true);

    const readme = nodes.find((node) => node.id === "README");
    expect(readme?.publish).toBe(false);
  });
});
