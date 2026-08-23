import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";
import { validateGraphSchema } from "./validate-graph-schema.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/basic-vault");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("buildSite (fixtures/basic-vault)", () => {
  it("writes index.html, one page per published note, graph.json and search-index.json", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-site-"));

    const { warnings } = buildSite(vaultDir, outDir);

    expect(warnings).toEqual([]);

    const topLevel = readdirSync(outDir).sort();
    expect(topLevel).toEqual(["graph.json", "index.html", "notes", "search-index.json"]);

    const noteFiles = readdirSync(path.join(outDir, "notes")).sort();
    expect(noteFiles).toEqual([
      "note-a.html",
      "note-b.html",
      "note-c-alias.html",
      "note-d-broken-link.html",
    ]);
  });

  it("renders resolved links, backlinks, and a broken-link span, and produces a schema-valid graph.json", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-site-"));
    buildSite(vaultDir, outDir);

    const noteA = readFileSync(path.join(outDir, "notes", "note-a.html"), "utf-8");
    expect(noteA).toContain('<a href="notes/note-b.html">note-b</a>');

    const noteB = readFileSync(path.join(outDir, "notes", "note-b.html"), "utf-8");
    // note-a links to note-b twice, so note-a should appear as a backlink.
    expect(noteB).toContain("Backlinks");
    expect(noteB).toContain('<a href="note-a.html">');

    const noteD = readFileSync(path.join(outDir, "notes", "note-d-broken-link.html"), "utf-8");
    expect(noteD).toContain('class="broken-link"');
    expect(noteD).toContain("does-not-exist");

    const graphJson = JSON.parse(readFileSync(path.join(outDir, "graph.json"), "utf-8"));
    const validation = validateGraphSchema(graphJson);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(graphJson.nodes.map((n: { id: string }) => n.id)).toEqual([
      "note-a",
      "note-b",
      "note-c-alias",
      "note-d-broken-link",
    ]);
  });
});
