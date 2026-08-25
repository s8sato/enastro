import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../graph/types.js";
import { renderNoteBody } from "./render-note.js";

// Math rendering (REQ-CONTENT-010, ADR-0017) doesn't depend on wikilink
// resolution, so an empty graph is sufficient for every case below.
const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] };

describe("math rendering (KaTeX, REQ-CONTENT-010)", () => {
  it("renders inline `$...$` math as a KaTeX span", () => {
    const { html } = renderNoteBody("Einstein: $E = mc^2$.", EMPTY_GRAPH);

    expect(html).toContain('class="katex"');
    expect(html).not.toContain("katex-display");
  });

  it("renders block `$$...$$` math with the display-mode class", () => {
    const { html } = renderNoteBody("$$\n\\int_0^1 x\\,dx\n$$", EMPTY_GRAPH);

    expect(html).toContain('class="katex-display"');
  });

  it("renders single-line block math `$$...$$` written entirely on one line", () => {
    const { html } = renderNoteBody("$$x^2 + y^2 = z^2$$", EMPTY_GRAPH);

    expect(html).toContain('class="katex-display"');
  });

  it("does not treat `$` inside a fenced code block as math", () => {
    const { html } = renderNoteBody("```\nprintf(\"$5 and $10\");\n```", EMPTY_GRAPH);

    expect(html).not.toContain("katex");
    expect(html).toContain("$5 and $10");
  });

  it("does not treat `$` inside inline code as math", () => {
    const { html } = renderNoteBody("Price: `$5 and $10`.", EMPTY_GRAPH);

    expect(html).not.toContain("katex");
    expect(html).toContain("$5 and $10");
  });

  it("does not treat a lone `$` followed by whitespace as math (avoids false positives like prices)", () => {
    const { html } = renderNoteBody("It costs $5 and $10 more.", EMPTY_GRAPH);

    expect(html).not.toContain("katex");
    expect(html).toContain("$5 and $10");
  });

  it("does not crash the build on malformed LaTeX; renders KaTeX's own error output instead (throwOnError: false)", () => {
    expect(() => renderNoteBody("$\\frac{1}{$", EMPTY_GRAPH)).not.toThrow();

    const { html } = renderNoteBody("$\\frac{1}{$", EMPTY_GRAPH);
    expect(html).toContain("katex-error");
  });

  it("neutralizes an attempted unsafe command instead of injecting a raw href (trust: false)", () => {
    const { html } = renderNoteBody("$\\href{javascript:alert(1)}{click}$", EMPTY_GRAPH);

    expect(html).not.toContain("javascript:");
  });
});
