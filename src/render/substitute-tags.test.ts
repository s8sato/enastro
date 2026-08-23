import { describe, expect, it } from "vitest";
import { substituteInlineTags } from "./substitute-tags.js";

describe("substituteInlineTags (REQ-UX-008)", () => {
  it("hyperlinks a simple inline tag", () => {
    expect(substituteInlineTags("This has an #inline-tag in it.")).toBe(
      "This has an [#inline-tag](../index.html?tags=inline-tag) in it.",
    );
  });

  it("hyperlinks multiple tags, preserving the preceding character", () => {
    expect(substituteInlineTags("#one and #two")).toBe(
      "[#one](../index.html?tags=one) and [#two](../index.html?tags=two)",
    );
  });

  it("does not treat ATX headings as tags", () => {
    expect(substituteInlineTags("# Heading\n\nSome text.")).toBe("# Heading\n\nSome text.");
  });

  it("hyperlinks a tag at the very start of the text", () => {
    expect(substituteInlineTags("#start-tag rest of line")).toBe(
      "[#start-tag](../index.html?tags=start-tag) rest of line",
    );
  });

  it("leaves tag-like text inside fenced code blocks untouched", () => {
    expect(substituteInlineTags("```\n#not-a-tag\n```")).toBe("```\n#not-a-tag\n```");
  });

  it("leaves tag-like text inside inline code untouched", () => {
    expect(substituteInlineTags("Use `#not-a-tag` as an example.")).toBe(
      "Use `#not-a-tag` as an example.",
    );
  });

  it("percent-encodes tag characters that need escaping in a query string", () => {
    expect(substituteInlineTags("A #tag/with-slash here")).toBe(
      "A [#tag/with-slash](../index.html?tags=tag%2Fwith-slash) here",
    );
  });
});
