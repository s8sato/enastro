import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../graph/types.js";
import { renderNoteBody } from "./render-note.js";

// External-link target/rel injection (REQ-UX-014) doesn't depend on
// wikilink resolution, so an empty graph is sufficient for every case below.
const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] };

describe("external links open in a new tab (REQ-UX-014)", () => {
  it("adds target=_blank and rel=noopener noreferrer to http(s) links", () => {
    const { html } = renderNoteBody("[enastro](https://github.com/s8sato/enastro/)", EMPTY_GRAPH);

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not add target/rel to relative (internal) links", () => {
    const { html } = renderNoteBody("[Note B](note-b.html)", EMPTY_GRAPH);

    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("does not add target/rel to mailto links", () => {
    const { html } = renderNoteBody("[Contact](mailto:someone@example.com)", EMPTY_GRAPH);

    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });
});
