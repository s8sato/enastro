import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../graph/types.js";
import { substituteLinks } from "./substitute-links.js";

// `modifiedAt` is irrelevant to link substitution, so test node literals
// omit it and this helper fills in a default.
function graph(nodes: Array<Omit<KnowledgeGraph["nodes"][number], "modifiedAt">>): KnowledgeGraph {
  return { nodes: nodes.map((node) => ({ ...node, modifiedAt: 0 })), edges: [] };
}

describe("substituteLinks", () => {
  it("rewrites a resolved public link into a Markdown link to a sibling note directory (../<id>/, ADR-0018), using the target note's title as the label (ADR-0009)", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      { id: "b", title: "B", aliases: [], tags: [], publish: true, path: "/b.md", body: "" },
    ]);

    const { text, removedTargets } = substituteLinks("See [[b]] for details.", g);

    expect(text).toBe("See [B](../b/) for details.");
    expect(removedTargets).toEqual([]);
  });

  it("uses the alias display text as the link label when provided", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      { id: "b", title: "B", aliases: [], tags: [], publish: true, path: "/b.md", body: "" },
    ]);

    const { text } = substituteLinks("See [[b|custom label]].", g);

    expect(text).toBe("See [custom label](../b/).");
  });

  it("uses the title, not the raw target/id text, as the label when id and title differ (ADR-0009)", () => {
    const g = graph([
      { id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" },
      {
        id: "note-x",
        title: "A Completely Different Title",
        aliases: [],
        tags: [],
        publish: true,
        path: "/note-x.md",
        body: "",
      },
    ]);

    const { text } = substituteLinks("See [[note-x]].", g);

    expect(text).toBe("See [A Completely Different Title](../note-x/).");
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
      "See [[secret|the secret plan]] and ![[confidential-alias]].",
      g,
    );

    expect(text).toBe("See  and .");
    expect(text).not.toContain("secret plan");
    expect(text).not.toContain("confidential-alias");
    expect(removedTargets).toEqual(["secret", "confidential-alias"]);
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

    const { text } = substituteLinks("Inline `[[b]]` and:\n```\n[[b]]\n```", g);

    expect(text).toBe("Inline `[[b]]` and:\n```\n[[b]]\n```");
  });

  it("rewrites an embed of an allowlisted attachment into a Markdown image pointing at ../../attachments/<id> (ADR-0018)", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);
    const attachments = [{ id: "attachments/public.png", filePath: "/vault/attachments/public.png" }];

    const { text, removedTargets } = substituteLinks("See ![[public.png]].", g, {
      attachments,
      publishedAttachmentIds: new Set(["attachments/public.png"]),
    });

    expect(text).toBe("See ![public.png](../../attachments/public.png).");
    expect(removedTargets).toEqual([]);
  });

  it("rewrites a plain (non-embed) link to an allowlisted attachment as a Markdown link", () => {
    const g = graph([{ id: "a", title: "A", aliases: [], tags: [], publish: true, path: "/a.md", body: "" }]);
    const attachments = [{ id: "attachments/public.png", filePath: "/vault/attachments/public.png" }];

    const { text } = substituteLinks("See [[public.png|the image]].", g, {
      attachments,
      publishedAttachmentIds: new Set(["attachments/public.png"]),
    });

    expect(text).toBe("See [the image](../../attachments/public.png).");
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
