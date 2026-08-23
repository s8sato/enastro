import type { PublicNode } from "../projection/types.js";
import { escapeHtml } from "./escape-html.js";

export interface RenderNotePageParams {
  node: PublicNode;
  bodyHtml: string;
  backlinks: PublicNode[];
}

/** Assembles a full HTML page for a single published note (REQ-UX-001~004). */
export function renderNotePage(params: RenderNotePageParams): string {
  const { node, bodyHtml, backlinks } = params;

  const tagsHtml = node.tags.length
    ? `<ul class="tags">${node.tags.map((tag) => `<li>#${escapeHtml(tag)}</li>`).join("")}</ul>`
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
<h1>${escapeHtml(node.title)}</h1>
${tagsHtml}
<article>${bodyHtml}</article>
${backlinksHtml}
</body>
</html>
`;
}

/** Assembles the site index page listing all published notes. */
export function renderIndexPage(nodes: PublicNode[]): string {
  const items = nodes
    .map((node) => `<li><a href="notes/${node.id}.html">${escapeHtml(node.title)}</a></li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>enastro</title>
</head>
<body>
<h1>Notes</h1>
<ul>${items}</ul>
</body>
</html>
`;
}
