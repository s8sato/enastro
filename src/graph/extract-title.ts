import MarkdownIt from "markdown-it";

// A dedicated, minimal-config instance is used here (as opposed to the one
// in src/render/render-note.ts) because this only needs to walk the token
// stream to find a heading; it must not enable raw `html` passthrough.
const markdown = new MarkdownIt();

/**
 * Extracts the plain-text content of the first top-level (`#`) heading in a
 * note body, if any (ADR-0009: the page title is derived from the note's
 * own content rather than a separate frontmatter field).
 *
 * Uses the Markdown token stream (rather than a line-based regex) so that a
 * `#` appearing inside a code fence/span or blockquote is not mistaken for
 * a heading.
 */
export function extractFirstH1(body: string): string | undefined {
  const tokens = markdown.parse(body, {});

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== "heading_open" || token.tag !== "h1") {
      continue;
    }

    const inline = tokens[i + 1];
    if (!inline || inline.type !== "inline") {
      return undefined;
    }

    const text = plainText(inline.children ?? []).trim();
    return text.length > 0 ? text : undefined;
  }

  return undefined;
}

function plainText(children: readonly { type: string; content: string }[]): string {
  return children.map((child) => child.content).join("");
}
