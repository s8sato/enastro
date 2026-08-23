import type { PublicNode } from "../projection/types.js";
import { escapeHtml } from "./escape-html.js";

export interface RenderNotePageParams {
  node: PublicNode;
  bodyHtml: string;
  backlinks: PublicNode[];
  /** Last-modified timestamp, already formatted in UTC (REQ-UX-007), e.g.
   * "2026-08-23 12:34 UTC". Baked in as a fixed UTC string so the build
   * stays deterministic (REQ-BUILD-001); `local-time.mjs` progressively
   * enhances this into the *viewer's* local timezone client-side. Not part
   * of `PublicNode`/`graph.json` (see `GraphNode.modifiedAt`'s doc comment). */
  modifiedAt: string;
  /** The same timestamp as `modifiedAt`, as raw epoch milliseconds, so
   * `local-time.mjs` can recompute it in the viewer's local timezone. */
  modifiedAtEpochMs: number;
}

/** Assembles a full HTML page for a single published note (REQ-UX-001~004, REQ-UX-006, REQ-UX-007, REQ-UX-008). */
export function renderNotePage(params: RenderNotePageParams): string {
  const { node, bodyHtml, backlinks, modifiedAt, modifiedAtEpochMs } = params;

  const tagsHtml = node.tags.length
    ? `<ul class="tags">${node.tags
        .map(
          (tag) =>
            `<li><a href="../index.html?tags=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a></li>`,
        )
        .join("")}</ul>`
    : "";

  const backlinksHtml = backlinks.length
    ? `<section class="backlinks"><h2>Backlinks</h2><ul>${backlinks
        .map((b) => `<li><a href="${b.id}.html">${escapeHtml(b.title)}</a></li>`)
        .join("")}</ul></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(node.title)}</title>
</head>
<body>
<nav><a href="../index.html">All notes</a></nav>
<p class="note-id"><code>${escapeHtml(node.id)}</code> <button type="button" class="copy-id" data-copy="${escapeHtml(node.id)}">Copy ID</button></p>
<p class="modified" data-modified="${modifiedAtEpochMs}">Last modified: ${escapeHtml(modifiedAt)}</p>
${tagsHtml}
<article>${bodyHtml}</article>
${backlinksHtml}
<script type="module" src="../assets/copy-id.mjs"></script>
<script type="module" src="../assets/local-time.mjs"></script>
</body>
</html>
`;
}

/**
 * Assembles the site index page listing all published notes, with a
 * client-side search box and tag filter UI (REQ-UX-001, REQ-UX-002). The
 * note list itself is always rendered server-side so it remains fully
 * usable without JavaScript (progressive enhancement); search.mjs only
 * hides/shows entries in place.
 */
export function renderIndexPage(nodes: PublicNode[]): string {
  const items = nodes
    .map(
      (node) =>
        `<li data-id="${escapeHtml(node.id)}"><a href="notes/${node.id}.html">${escapeHtml(node.title)}</a></li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>enastro</title>
</head>
<body>
<h1>Notes</h1>
<input type="search" id="search-box" placeholder="Search notes...">
<div id="tag-filters"></div>
<p id="no-results" hidden>No notes match the current search/filter.</p>
<ul id="note-list">${items}</ul>
<script type="module" src="assets/search.mjs"></script>
</body>
</html>
`;
}
