import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
    expect(topLevel).toEqual(["assets", "graph.html", "graph.json", "index.html", "notes", "search-index.json"]);

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
    // The inline wikilink lives inside <article>, alongside its surrounding
    // prose, to avoid a false-positive match against the (correct)
    // same-looking href in the unrelated <section class="backlinks"> below.
    expect(noteA).toContain('This note links to <a href="note-b.html">Note B</a>');
    // The note's own first H1 (from its body) is the only <h1>; the page no
    // longer injects a separate title heading (ADR-0009). The note id is
    // instead shown as a small, always-visible, click-to-copy string.
    expect(noteA).toContain("<article><h1>Note A</h1>");
    expect(noteA).toContain('<p class="note-id"><code>note-a</code>');
    expect(noteA).toContain('data-copy="note-a"');
    expect(noteA).toContain('<script type="module" src="../assets/copy-id.mjs"></script>');
    // Every note page links back to the index/landing page (REQ-UX-006).
    expect(noteA).toContain(
      '<nav><a href="../index.html">All notes</a> <a href="../graph.html">Graph view</a><button type="button" id="exploration-rewind-toggle" hidden>HISTORY</button></nav>',
    );
    // Every note page shows its last-modified ("Updated") timestamp,
    // formatted in UTC as a deterministic no-JS fallback (REQ-UX-007,
    // REQ-BUILD-001), with the raw epoch ms also present so
    // `local-time.mjs` can progressively enhance it into the viewer's
    // local timezone. The exact value depends on the fixture file's real
    // mtime (checkout-dependent), so only the format is asserted here.
    expect(noteA).toMatch(
      /<span class="date-label">Updated<\/span> <span class="date-value" data-modified="\d+">\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC<\/span>/,
    );
    expect(noteA).toContain('<script type="module" src="../assets/local-time.mjs"></script>');
    // Theme switcher trigger + client script present on every note page
    // (REQ-UX-011), and the FOUC-prevention inline script runs before
    // site.css would otherwise paint the default theme.
    expect(noteA).toContain('id="theme-trigger"');
    expect(noteA).toContain('<script type="module" src="../assets/theme-switcher.mjs"></script>');
    expect(noteA).toContain('localStorage.getItem("enastro:theme:v1")');
    // Tags are links to the index page pre-filtered by that tag (REQ-UX-008).
    expect(noteA).toContain('<a href="../index.html?tags=example">#example</a>');
    expect(noteA).toContain('<a href="../index.html?tags=inline-tag">#inline-tag</a>');
    // ...including inline `#tag` mentions inside the note body itself, not
    // just the tag list near the note id (REQ-UX-008).
    expect(noteA).toContain(
      'It also has an inline <a href="../index.html?tags=inline-tag">#inline-tag</a>.',
    );

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

    // graph.json's schema is a closed whitelist (id/title/tags plus
    // precomputed x/y layout coordinates, ADR-0006/0010/0012) and
    // deliberately does NOT carry modifiedAt (see GraphNode.modifiedAt's
    // doc comment); it is only exposed via note pages and search-index.json.
    for (const node of graphJson.nodes) {
      expect(Object.keys(node).sort()).toEqual(["id", "tags", "title", "x", "y"]);
    }

    const searchIndex = JSON.parse(readFileSync(path.join(outDir, "search-index.json"), "utf-8"));
    for (const entry of searchIndex) {
      expect(entry.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
    }
  });

  // ADR-0015: when a note's last-modified date can't be determined from
  // git history (here: a fresh, non-git temp vault), `modifiedAt` is
  // "unknown" rather than falling back to filesystem mtime. This must be
  // surfaced as an *absence* (no "Updated" line, no `modifiedAt` key in
  // search-index.json) rather than a placeholder/incorrect date.
  it("omits the 'Updated' line and the search-index modifiedAt field when the vault has no git history", () => {
    const nonGitVaultDir = mkdtempSync(path.join(tmpdir(), "enastro-site-nongit-vault-"));
    writeFileSync(path.join(nonGitVaultDir, "note-a.md"), "---\npublish: true\n---\n# Note A\n\nBody.");
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-site-nongit-out-"));

    try {
      buildSite(nonGitVaultDir, outDir);

      const noteA = readFileSync(path.join(outDir, "notes", "note-a.html"), "utf-8");
      expect(noteA).not.toContain("data-modified");
      expect(noteA).not.toContain("Updated");
      expect(noteA).toContain('<p class="note-dates">');

      const searchIndex = JSON.parse(readFileSync(path.join(outDir, "search-index.json"), "utf-8"));
      expect(searchIndex).toHaveLength(1);
      expect("modifiedAt" in searchIndex[0]).toBe(false);
    } finally {
      rmSync(nonGitVaultDir, { recursive: true, force: true });
    }
  });
});
