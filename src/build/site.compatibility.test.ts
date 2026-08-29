import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/compatibility-vault");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("buildSite (fixtures/compatibility-vault, REQ-CONTENT-005/008)", () => {
  it("builds without error and discovers/resolves Japanese and emoji filenames correctly", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-compat-"));

    expect(() => buildSite(vaultDir, outDir)).not.toThrow();

    const noteFiles = readdirSync(path.join(outDir, "notes")).sort();
    expect(noteFiles).toEqual(
      ["unsupported-syntax", "日本語のノート", "絵文字-emoji-📘"].sort(),
    );

    const graphJson = JSON.parse(readFileSync(path.join(outDir, "graph.json"), "utf-8")) as {
      nodes: Array<{ id: string }>;
    };
    expect(graphJson.nodes.map((n) => n.id).sort()).toEqual(
      ["unsupported-syntax", "絵文字-emoji-📘", "日本語のノート"].sort(),
    );
  });

  it("resolves the Japanese-named wikilink and generates a backlink on the emoji-named note", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-compat-"));
    buildSite(vaultDir, outDir);

    const jaNote = readFileSync(path.join(outDir, "notes", "日本語のノート", "index.html"), "utf-8");
    // markdown-it percent-encodes non-ASCII characters in href attributes;
    // this is standards-compliant and browsers resolve it back to the
    // literal Unicode directory name on disk. The href is relative to the
    // note's own directory (notes/<id>/, ADR-0018), so a sibling note link
    // goes up one level then into the target's own directory.
    expect(jaNote).toContain(
      '<a href="../%E7%B5%B5%E6%96%87%E5%AD%97-emoji-%F0%9F%93%98/">',
    );

    const emojiNote = readFileSync(path.join(outDir, "notes", "絵文字-emoji-📘", "index.html"), "utf-8");
    expect(emojiNote).toContain("Backlinks");
    expect(emojiNote).toContain('<a href="../日本語のノート/">');
  });

  it("passes unsupported OFM syntax through unchanged, without failing the build", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-compat-"));
    buildSite(vaultDir, outDir);

    const html = readFileSync(path.join(outDir, "notes", "unsupported-syntax", "index.html"), "utf-8");

    // Callout: renders as a plain blockquote, the `[!note]` marker is not
    // specially interpreted and remains as literal text.
    expect(html).toContain("[!note]");
    expect(html).toContain("<blockquote>");

    // Heading link / block reference: excluded from the wikilink pattern
    // (target contains `#`), so they remain as literal, unconverted text.
    expect(html).toContain("[[日本語のノート#heading]]");
    expect(html).toContain("[[日本語のノート#^blockid]]");
    expect(html).not.toContain('href="../日本語のノート/#heading"');

    // dataview / canvas-like code blocks: pass through as plain code, with
    // no special interpretation. The JSON blob is now syntax-highlighted
    // (server-side, via highlight.js) since it's tagged ```json, so its
    // tokens are individually wrapped in `hljs-*` spans rather than
    // appearing as one contiguous string — check the substrings that
    // remain intact within a single span instead of the whole line.
    expect(html).toContain("LIST FROM #tag");
    expect(html).toContain('"nodes"');
    expect(html).toContain('"edges"');
    // Scoped to the rendered <article> (sanitized user content): the page
    // shell itself legitimately contains a static, enastro-authored
    // <script type="module"> for the id click-to-copy widget (ADR-0009).
    const articleMatch = html.match(/<article>[\s\S]*?<\/article>/);
    expect(articleMatch).not.toBeNull();
    expect(articleMatch![0]).not.toMatch(/<script[\s>]/i);
  });
});
