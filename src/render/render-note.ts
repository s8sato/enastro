import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import type { KnowledgeGraph } from "../graph/types.js";
import { sanitizeHtml } from "../sanitize/index.js";
import { substituteInlineTags } from "./substitute-tags.js";
import { substituteLinks, type SubstituteLinksOptions } from "./substitute-links.js";

// `html: true` allows the `.broken-link` span produced by substituteLinks to
// pass through; `sanitizeHtml` below provides defense-in-depth against any
// other raw HTML present in the source note (REQ-SEC-003).
//
// Syntax highlighting is done server-side at build time via highlight.js's
// Node API (rather than shipping a highlighter to the browser), so the
// output stays a fully static, self-contained artifact (REQ-UX-004,
// REQ-BUILD-001) — no client-side script or extra network request is
// needed just to color code blocks. The resulting `hljs-*` spans are
// colored by site.css; see sanitize/config.ts for the matching allowlist.
const markdown: InstanceType<typeof MarkdownIt> = new MarkdownIt({
  html: true,
  highlight(code, lang): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        // fall through to the unhighlighted default below
      }
    }
    return `<pre class="hljs"><code>${markdown.utils.escapeHtml(code)}</code></pre>`;
  },
});

export interface RenderNoteBodyResult {
  html: string;
  removedTargets: string[];
}

/** Renders a note's Markdown body to sanitized HTML (REQ-UX-001~004). */
export function renderNoteBody(
  body: string,
  graph: KnowledgeGraph,
  options: SubstituteLinksOptions = {},
): RenderNoteBodyResult {
  const withTagLinks = substituteInlineTags(body);
  const { text, removedTargets } = substituteLinks(withTagLinks, graph, options);
  const html = sanitizeHtml(markdown.render(text));
  return { html, removedTargets };
}
