import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraph } from "../graph/build.js";
import { computeBacklinks } from "../graph/backlinks.js";
import { buildPublicProjection } from "./build.js";

const PRIVACY_VAULT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "privacy-vault",
);

describe("buildPublicProjection against fixtures/privacy-vault", () => {
  it("excludes the private note from the public node list", () => {
    const { graph } = buildGraph(PRIVACY_VAULT_DIR);
    const { projection } = buildPublicProjection(graph);

    const ids = projection.nodes.map((node) => node.id);
    expect(ids).not.toContain("private-note");
    expect(ids).toEqual(expect.arrayContaining(["public-note", "another-public-note"]));
  });

  it("removes both the wikilink and embed edges from public-note to private-note", () => {
    const { graph } = buildGraph(PRIVACY_VAULT_DIR);
    const { projection } = buildPublicProjection(graph);

    const edgesToPrivateNote = projection.edges.filter((edge) => edge.target === "private-note");
    expect(edgesToPrivateNote).toEqual([]);
  });

  it("never exposes the private note's id, title, tags, or alias anywhere in the projection (privacy scan)", () => {
    const { graph } = buildGraph(PRIVACY_VAULT_DIR);
    const { projection } = buildPublicProjection(graph);
    const serialized = JSON.stringify(projection);

    expect(serialized).not.toContain("private-note");
    expect(serialized).not.toContain("Private Note");
    expect(serialized).not.toContain("private-secret");
    expect(serialized).not.toContain("confidential-alias");
  });

  it("preserves a normal public-to-public edge and its backlink", () => {
    const { graph } = buildGraph(PRIVACY_VAULT_DIR);
    const { projection } = buildPublicProjection(graph);

    expect(projection.edges).toContainEqual({
      source: "another-public-note",
      target: "public-note",
      kind: "wikilink",
    });

    const backlinks = computeBacklinks(projection.edges);
    const publicNoteBacklinkSources = (backlinks.get("public-note") ?? []).map(
      (edge) => edge.source,
    );
    expect(publicNoteBacklinkSources).toEqual(["another-public-note"]);
  });

  it("records private-log-only warnings for each removed edge (REQ-PUB-004)", () => {
    const { graph } = buildGraph(PRIVACY_VAULT_DIR);
    const { warnings } = buildPublicProjection(graph);

    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes("wikilink") && w.includes("private-note"))).toBe(true);
    expect(warnings.some((w) => w.includes("embed") && w.includes("private-note"))).toBe(true);
  });
});
