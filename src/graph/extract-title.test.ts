import { describe, expect, it } from "vitest";
import { extractFirstH1 } from "./extract-title.js";

describe("extractFirstH1", () => {
  it("extracts the plain text of the first top-level heading", () => {
    expect(extractFirstH1("# Note A\n\nSome body text.")).toBe("Note A");
  });

  it("strips inline markdown formatting from the heading text", () => {
    expect(extractFirstH1("# **Bold** and `code`\n\nBody.")).toBe("Bold and code");
  });

  it("returns undefined when the body has no top-level heading", () => {
    expect(extractFirstH1("## Only a subheading\n\nBody.")).toBeUndefined();
    expect(extractFirstH1("Just a paragraph, no heading at all.")).toBeUndefined();
  });

  it("does not mistake a '#' inside a code fence or code span for a heading", () => {
    expect(extractFirstH1("```\n# not a heading\n```\n\n`# also not a heading`")).toBeUndefined();
  });

  it("uses only the first heading when multiple top-level headings exist", () => {
    expect(extractFirstH1("# First\n\n# Second")).toBe("First");
  });
});
