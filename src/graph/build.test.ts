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
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const ids = graph.nodes.map((node) => node.id).sort();
    expect(ids).toEqual([
      "README",
      "note-a",
      "note-b",
      "note-c-alias",
      "note-d-broken-link",
    ]);
  });

  it("derives each note's title from its first H1 heading (ADR-0009)", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const titleById = new Map(graph.nodes.map((node) => [node.id, node.title]));
    expect(titleById.get("note-a")).toBe("Note A");
    expect(titleById.get("note-b")).toBe("Note B");
    expect(titleById.get("note-c-alias")).toBe("Note C Alias");
    expect(titleById.get("note-d-broken-link")).toBe("Note D Broken Link");
  });

  it("creates directed edges for note-a's two links to note-b", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const noteAEdges = graph.edges.filter((edge) => edge.source === "note-a");
    expect(noteAEdges).toHaveLength(2);
    expect(noteAEdges.every((edge) => edge.target === "note-b" && edge.kind === "wikilink")).toBe(
      true,
    );
  });

  it("resolves note-c-alias's link to note-b via id match, not its own colliding alias (ADR-0009)", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const noteCEdges = graph.edges.filter((edge) => edge.source === "note-c-alias");
    expect(noteCEdges).toEqual([{ source: "note-c-alias", target: "note-b", kind: "wikilink" }]);
  });

  it("does not create an edge for a broken link and does not throw (REQ-CONTENT-007)", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const noteDEdges = graph.edges.filter((edge) => edge.source === "note-d-broken-link");
    expect(noteDEdges).toEqual([]);
  });

  it("derives backlinks for note-b from note-a and note-c-alias (REQ-GRAPH-003)", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const backlinks = computeBacklinks(graph.edges);
    const noteBBacklinkSources = (backlinks.get("note-b") ?? []).map((edge) => edge.source).sort();
    expect(noteBBacklinkSources).toEqual(["note-a", "note-a", "note-c-alias"]);
  });

  it("marks all 4 notes as publish: true, and the frontmatter-less README as publish: false", () => {
    const { graph } = buildGraph(BASIC_VAULT_DIR);
    const notes = graph.nodes.filter((node) => node.id !== "README");
    expect(notes.every((node) => node.publish)).toBe(true);

    const readme = graph.nodes.find((node) => node.id === "README");
    expect(readme?.publish).toBe(false);
  });
});
