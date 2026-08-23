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

  it("quietly drops the wikilink and embed pointing to the private note", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-privacy-"));
    buildSite(vaultDir, outDir);

    const publicNote = readFileSync(path.join(outDir, "notes", "public-note.html"), "utf-8");
    expect(publicNote).not.toContain("private-note.html");
    expect(publicNote).not.toContain("broken-link");
  });
});
