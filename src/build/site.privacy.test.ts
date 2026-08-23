import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/privacy-vault");

// "private-note" (the id) is deliberately excluded here: fixtures/privacy-vault's
// own *public* prose (another-public-note.md) legitimately mentions it as
// documentation text describing the test scenario, which is not a leak (the
// author of a published note chose to write that text). The real invariant
// under test is that the private note's title/tags/aliases/rendered page/
// link never appear, checked explicitly below.
const FORBIDDEN_STRINGS = ["Private Note", "private-secret", "confidential-alias"];

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

function readAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...readAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

describe("buildSite privacy scan (fixtures/privacy-vault)", () => {
  it("never leaks a private note's id, title, tags, or aliases into the artifact (REQ-SEC-001)", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-privacy-"));
    buildSite(vaultDir, outDir);

    const files = readAllFiles(outDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const forbidden of FORBIDDEN_STRINGS) {
        expect(content, `${path.relative(outDir, file)} must not contain "${forbidden}"`).not.toContain(forbidden);
      }
    }

    // The private note itself must not have a rendered page, and no link may
    // point to it.
    const noteFiles = readdirSync(path.join(outDir, "notes"));
    expect(noteFiles).not.toContain("private-note.html");
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content, `${path.relative(outDir, file)} must not link to private-note.html`).not.toContain(
        "private-note.html",
      );
    }

    const graphJson = readFileSync(path.join(outDir, "graph.json"), "utf-8");
    const graph = JSON.parse(graphJson) as { nodes: Array<{ id: string }> };
    expect(graph.nodes.map((n) => n.id)).not.toContain("private-note");
  });

  it("never exposes the private note's identity via graph.json's layout coordinates or graph.html (REQ-SEC-001, ADR-0010/0012)", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-privacy-"));
    buildSite(vaultDir, outDir);

    const graph = JSON.parse(readFileSync(path.join(outDir, "graph.json"), "utf-8")) as {
      nodes: Array<{ id: string; x: number; y: number }>;
      edges: Array<{ source: string; target: string }>;
    };

    // Layout coordinates are computed over the public projection only, so
    // the private note must not appear as a node at all (and therefore
    // cannot have leaked coordinates), and no edge may reference it.
    expect(graph.nodes.map((n) => n.id)).not.toContain("private-note");
    for (const edge of graph.edges) {
      expect(edge.source).not.toBe("private-note");
      expect(edge.target).not.toBe("private-note");
    }
    for (const node of graph.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }

    // graph.html itself templates no node/edge data server-side (it only
    // wires up a client script that fetches the already-public graph.json),
    // so it cannot leak anything by construction; asserted here anyway as a
    // regression guard.
    const graphHtml = readFileSync(path.join(outDir, "graph.html"), "utf-8");
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(graphHtml).not.toContain(forbidden);
    }
    expect(graphHtml).not.toContain("private-note");
  });


  it("quietly drops the wikilink and embed pointing to the private note", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-privacy-"));
    buildSite(vaultDir, outDir);

    const publicNote = readFileSync(path.join(outDir, "notes", "public-note.html"), "utf-8");
    expect(publicNote).not.toContain("private-note.html");
    expect(publicNote).not.toContain("broken-link");
  });

  it("publishes only the allowlisted attachment (REQ-PUB-006, REQ-SEC-002, ADR-0003)", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-privacy-"));
    buildSite(vaultDir, outDir);

    const publishedPath = path.join(outDir, "attachments", "public.png");
    const sourcePath = path.join(vaultDir, "attachments", "public.png");
    expect(readFileSync(publishedPath)).toEqual(readFileSync(sourcePath));

    // The non-allowlisted attachment must never be copied into dist/, and
    // its filename must not appear anywhere in the artifact.
    const attachmentFiles = readdirSync(path.join(outDir, "attachments"));
    expect(attachmentFiles).toEqual(["public.png"]);

    for (const file of readAllFiles(outDir)) {
      const content = readFileSync(file, "utf-8");
      expect(content, `${path.relative(outDir, file)} must not mention private.png`).not.toContain("private.png");
    }

    const publicNote = readFileSync(path.join(outDir, "notes", "public-note.html"), "utf-8");
    expect(publicNote).toContain('src="../attachments/public.png"');
  });
});
