import { describe, expect, it } from "vitest";
import { extractInlineTags } from "./tags.js";

describe("extractInlineTags", () => {
  it("extracts a simple inline tag", () => {
    expect(extractInlineTags("This has an #inline-tag in it.")).toEqual(["inline-tag"]);
  });

  it("extracts multiple tags", () => {
    expect(extractInlineTags("#one and #two")).toEqual(["one", "two"]);
  });

  it("does not treat ATX headings as tags", () => {
    expect(extractInlineTags("# Heading\n\nSome text.")).toEqual([]);
  });

  it("extracts a tag at the very start of the text", () => {
    expect(extractInlineTags("#start-tag rest of line")).toEqual(["start-tag"]);
  });

  it("ignores tag-like text inside fenced code blocks", () => {
    expect(extractInlineTags("```\n#not-a-tag\n```")).toEqual([]);
  });

  it("ignores tag-like text inside inline code", () => {
    expect(extractInlineTags("Use `#not-a-tag` as an example.")).toEqual([]);
  });
});
