import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "./index.js";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "basic-vault",
);

function readFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf-8");
}

describe("parseDocument against fixtures/basic-vault", () => {
  it("parses note-a.md: publish:true, tags, and two links to note-b", () => {
    const doc = parseDocument(readFixture("note-a.md"));

    expect(doc.frontmatter.publish).toBe(true);
    expect(doc.frontmatter.tags).toEqual(["example"]);
    expect(doc.inlineTags).toEqual(["inline-tag"]);

    const wikilinks = doc.links.filter((link) => link.kind === "wikilink");
    expect(wikilinks).toHaveLength(2);
    expect(wikilinks.every((link) => link.target === "note-b")).toBe(true);
    expect(wikilinks.some((link) => link.display === "表示名")).toBe(true);
    expect(wikilinks.some((link) => link.display === undefined)).toBe(true);
  });

  it("parses note-b.md: publish:true with a link back to note-a", () => {
    const doc = parseDocument(readFixture("note-b.md"));

    expect(doc.frontmatter.publish).toBe(true);
    expect(doc.links).toEqual([{ kind: "wikilink", target: "note-a", display: undefined }]);
  });

  it("parses note-c-alias.md: publish:true with an alias colliding with note-b's title", () => {
    const doc = parseDocument(readFixture("note-c-alias.md"));

    expect(doc.frontmatter.publish).toBe(true);
    expect(doc.frontmatter.aliases).toEqual(["note-b"]);
    expect(doc.links.some((link) => link.target === "note-b")).toBe(true);
  });

  it("parses note-d-broken-link.md: publish:true with a link to a non-existent note", () => {
    const doc = parseDocument(readFixture("note-d-broken-link.md"));

    expect(doc.frontmatter.publish).toBe(true);
    expect(doc.links).toEqual([
      { kind: "wikilink", target: "does-not-exist", display: undefined },
    ]);
  });
});

describe("parseDocument: unsupported OFM syntax passes through without error (REQ-CONTENT-005)", () => {
  it.each([
    ["callout", "> [!note]\n> This is a callout."],
    ["heading link", "See [[note#heading]] for details."],
    ["block reference", "See [[note#^blockid]] for details."],
    ["dataview query", "```dataview\nLIST FROM #tag\n```"],
    ["canvas-like JSON blob", '{"nodes": [], "edges": []}'],
  ])("does not throw for %s and preserves the text in body", (_label, snippet) => {
    const raw = ["---", "publish: true", "---", "", snippet].join("\n");

    expect(() => parseDocument(raw)).not.toThrow();
    const doc = parseDocument(raw);
    expect(doc.body).toContain(snippet.split("\n")[0]);
  });
});
