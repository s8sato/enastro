import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses publish, tags, and aliases from a YAML frontmatter block", () => {
    const raw = [
      "---",
      "publish: true",
      "tags: [a, b]",
      "aliases: [note-b]",
      "---",
      "",
      "# Body",
    ].join("\n");

    const { frontmatter, body } = parseFrontmatter(raw);

    expect(frontmatter.publish).toBe(true);
    expect(frontmatter.tags).toEqual(["a", "b"]);
    expect(frontmatter.aliases).toEqual(["note-b"]);
    expect(body.trim()).toBe("# Body");
  });

  it("defaults to publish: false when frontmatter is absent (private by default)", () => {
    const { frontmatter, body } = parseFrontmatter("# No frontmatter here");

    expect(frontmatter.publish).toBe(false);
    expect(frontmatter.tags).toEqual([]);
    expect(frontmatter.aliases).toEqual([]);
    expect(body).toBe("# No frontmatter here");
  });

  it("defaults to publish: false when publish is missing or not literally true", () => {
    const raw = ["---", "tags: [a]", "---", "body"].join("\n");
    const { frontmatter } = parseFrontmatter(raw);

    expect(frontmatter.publish).toBe(false);
  });
});
