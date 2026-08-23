import MarkdownIt from "markdown-it";
import type { KnowledgeGraph } from "../graph/types.js";
import { sanitizeHtml } from "../sanitize/index.js";
import { substituteLinks } from "./substitute-links.js";

// `html: true` allows the `.broken-link` span produced by substituteLinks to
// pass through; `sanitizeHtml` below provides defense-in-depth against any
// other raw HTML present in the source note (REQ-SEC-003).
const markdown = new MarkdownIt({ html: true });

export interface RenderNoteBodyResult {
  html: string;
  removedTargets: string[];
}

/** Renders a note's Markdown body to sanitized HTML (REQ-UX-001~004). */
export function renderNoteBody(body: string, graph: KnowledgeGraph): RenderNoteBodyResult {
  const { text, removedTargets } = substituteLinks(body, graph);
  const html = sanitizeHtml(markdown.render(text));
  return { html, removedTargets };
}
