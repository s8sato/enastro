import { describe, expect, it } from "vitest";
import { extractWikilinks } from "./wikilink.js";

describe("extractWikilinks", () => {
  it("extracts a plain wikilink", () => {
    const refs = extractWikilinks("See [[note-b]] for details.");
    expect(refs).toEqual([{ kind: "wikilink", target: "note-b", display: undefined }]);
  });

  it("extracts a wikilink with an alias display text", () => {
    const refs = extractWikilinks("See [[note-b|表示名]] for details.");
    expect(refs).toEqual([{ kind: "wikilink", target: "note-b", display: "表示名" }]);
  });

  it("extracts an embed", () => {
    const refs = extractWikilinks("![[note-b]]");
    expect(refs).toEqual([{ kind: "embed", target: "note-b", display: undefined }]);
  });

  it("extracts multiple links from the same body", () => {
    const refs = extractWikilinks("[[note-b]] and [[note-b|表示名]]");
    expect(refs).toHaveLength(2);
  });

  it("does not match heading links (unsupported OFM syntax passes through)", () => {
    const refs = extractWikilinks("See [[note-b#some-heading]] for details.");
    expect(refs).toEqual([]);
  });

  it("does not match block references (unsupported OFM syntax passes through)", () => {
    const refs = extractWikilinks("See [[note-b#^blockid]] for details.");
    expect(refs).toEqual([]);
  });

  it("ignores wikilink-like text inside fenced code blocks", () => {
    const refs = extractWikilinks("```\n[[not-a-real-link]]\n```");
    expect(refs).toEqual([]);
  });

  it("ignores wikilink-like text inside inline code", () => {
    const refs = extractWikilinks("Use `[[note]]` syntax to link.");
    expect(refs).toEqual([]);
  });
});
