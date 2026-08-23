import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../graph/types.js";
import { substituteLinks } from "./substitute-links.js";

function graph(nodes: KnowledgeGraph["nodes"]): KnowledgeGraph {
  return { nodes, edges: [] };
}

describe("substituteLinks", () => {
  it("rewrites a resolved public link into a Markdown link to <id>.html (same-directory relative path)", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      { id: "b", title: "B", aliases: [], tags: [], publish: true, path: "/b.md", body: "" },
    ]);

    const { text, removedTargets } = substituteLinks("See [[B]] for details.", g);

    expect(text).toBe("See [B](b.html) for details.");
    expect(removedTargets).toEqual([]);
  });

  it("uses the alias display text as the link label when provided", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      { id: "b", title: "B", aliases: [], tags: [], publish: true, path: "/b.md", body: "" },
    ]);

    const { text } = substituteLinks("See [[B|custom label]].", g);

    expect(text).toBe("See [custom label](b.html).");
  });

  it("deletes an occurrence entirely (including display text) when the target is unpublished", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      {
        id: "secret",
        title: "Secret Project Codename",
        aliases: ["confidential-alias"],
        tags: [],
        publish: false,
        path: "/secret.md",
        body: "",
      },
    ]);

    const { text, removedTargets } = substituteLinks(
      "See [[Secret Project Codename|the secret plan]] and ![[confidential-alias]].",
      g,
    );

    expect(text).toBe("See  and .");
    expect(text).not.toContain("Secret Project Codename");
    expect(text).not.toContain("secret plan");
    expect(text).not.toContain("confidential-alias");
    expect(removedTargets).toEqual(["Secret Project Codename", "confidential-alias"]);
  });

  it("renders unresolved/ambiguous links as plain text inside a .broken-link span", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);

    const { text } = substituteLinks("See [[Does Not Exist]].", g);

    expect(text).toBe('See <span class="broken-link">Does Not Exist</span>.');
  });

  it("leaves wikilink-like text inside code spans/fences untouched", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      { id: "b", title: "B", aliases: [], tags: [], publish: true, path: "/b.md", body: "" },
    ]);

    const { text } = substituteLinks("Inline `[[B]]` and:\n```\n[[B]]\n```", g);

    expect(text).toBe("Inline `[[B]]` and:\n```\n[[B]]\n```");
  });

  it("rewrites an embed of an allowlisted attachment into a Markdown image pointing at ../attachments/<id>", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);
    const attachments = [{ id: "attachments/public.png", filePath: "/vault/attachments/public.png" }];

    const { text, removedTargets } = substituteLinks("See ![[public.png]].", g, {
      attachments,
      publishedAttachmentIds: new Set(["attachments/public.png"]),
    });

    expect(text).toBe("See ![public.png](../attachments/public.png).");
    expect(removedTargets).toEqual([]);
  });

  it("rewrites a plain (non-embed) link to an allowlisted attachment as a Markdown link", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);
    const attachments = [{ id: "attachments/public.png", filePath: "/vault/attachments/public.png" }];

    const { text } = substituteLinks("See [[public.png|the image]].", g, {
      attachments,
      publishedAttachmentIds: new Set(["attachments/public.png"]),
    });

    expect(text).toBe("See [the image](../attachments/public.png).");
  });

  it("deletes an embed of a non-allowlisted attachment entirely (ADR-0003)", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);
    const attachments = [{ id: "attachments/private.png", filePath: "/vault/attachments/private.png" }];

    const { text, removedTargets } = substituteLinks("See ![[private.png]].", g, {
      attachments,
      publishedAttachmentIds: new Set(),
    });

    expect(text).toBe("See .");
    expect(text).not.toContain("private.png");
    expect(removedTargets).toEqual(["private.png"]);
  });
});
