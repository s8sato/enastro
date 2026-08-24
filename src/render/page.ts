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
   * of `PublicNode`/`graph.json` (see `GraphNode.modifiedAt`'s doc comment).
   * `undefined` means the note's last-modified date is unknown (no git
   * history for it, ADR-0015) — in that case the whole "Updated" line is
   * omitted rather than showing a placeholder or fallback date. */
  modifiedAt: string | undefined;
  /** The same timestamp as `modifiedAt`, as raw epoch milliseconds, so
   * `local-time.mjs` can recompute it in the viewer's local timezone.
   * `undefined` iff `modifiedAt` is. */
  modifiedAtEpochMs: number | undefined;
}

/**
 * Markup for the exploration-status rewind UI (REQ-EXPLORE-003), shared
 * across all three page kinds. Hidden by default and populated/revealed by
 * exploration.mjs (progressive enhancement, same pattern as local-time.mjs);
 * without JavaScript it simply stays invisible and inert.
 *
 * `rootPrefix` is the relative path back to the site root (e.g. `"../"` for
 * note pages, `""` for index/graph pages) — needed so exploration.mjs can
 * fetch the already-public `search-index.json` (for ID-mismatch detection
 * and stale-read detection, REQ-EXPLORE-006/007) regardless of which page
 * kind it's running on.
 */
function renderExplorationBar(assetsPrefix: string, rootPrefix: string): string {
  return `<div id="exploration-bar" class="exploration-bar" data-search-index-href="${rootPrefix}search-index.json" hidden>
<button type="button" id="exploration-rewind-toggle">History</button>
<div id="exploration-rewind-panel" hidden>
<p id="exploration-storage-warning" class="exploration-warning" hidden></p>
<p id="exploration-missing-notice" class="exploration-notice" hidden></p>
<p id="exploration-auto-unread-notice" class="exploration-notice" hidden></p>
<button type="button" id="exploration-return-to-now" hidden>Return to now</button>
<button type="button" id="exploration-reset-here" hidden>Reset to here</button>
<button type="button" id="exploration-prune-here" hidden>Prune until here</button>
<ul id="exploration-history-list"></ul>
</div>
</div>
<script type="module" src="${assetsPrefix}exploration.mjs"></script>`;
}

/**
 * FOUC-prevention script for the theme switcher (REQ-UX-011). Small,
 * inline, and *not* externalized (unlike the module scripts below) so it
 * runs synchronously before first paint: it reads the persisted theme
 * choice from `localStorage` and applies `data-theme` to `<html>`
 * immediately, before `site.css` would otherwise paint the default (Moon)
 * theme. Without JavaScript (or before it runs), the page simply renders
 * in the Moon theme — the same progressive-enhancement approach as
 * `local-time.mjs`. Kept as a single literal shared by all three page
 * kinds so their FOUC-prevention behavior can never drift apart.
 */
const THEME_FOUC_SCRIPT = `<script>(function(){try{var t=localStorage.getItem("enastro:theme:v1");if(t)document.documentElement.dataset.theme=t;}catch(e){}})();</script>`;

/**
 * Markup for the theme switcher trigger (REQ-UX-011), shared across all
 * three page kinds. Deliberately kept independent of `<nav>` (rather than
 * a nav link) and styled as a small floating widget fixed to the
 * bottom-left corner — symmetric with the exploration bar's bottom-right
 * placement (`.exploration-bar`) — so neither widget competes with the
 * page's nav/tag-filter chrome or with each other. The actual dial/select
 * UI is built by theme-switcher.mjs (progressive enhancement); without
 * JavaScript only the inert trigger button exists.
 */
function renderThemeSwitcher(assetsPrefix: string): string {
  return `<div id="theme-switcher" class="theme-switcher" hidden>
<button type="button" id="theme-trigger" aria-haspopup="dialog" aria-controls="theme-dialog">Theme</button>
<div id="theme-dialog" hidden></div>
</div>
<script type="module" src="${assetsPrefix}theme-switcher.mjs"></script>`;
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

  // Omitted entirely (not just blank) when unknown (ADR-0015: no git
  // history for this note) — showing no date is preferable to showing a
  // placeholder or a stale/incorrect one.
  const updatedHtml =
    modifiedAt !== undefined
      ? `<span class="date-group"><span class="date-label">Updated</span> <span class="date-value" data-modified="${modifiedAtEpochMs}">${escapeHtml(modifiedAt)}</span></span>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(node.title)}</title>
<link rel="stylesheet" href="../assets/site.css">
${THEME_FOUC_SCRIPT}
</head>
<body>
<nav><a href="../index.html">All notes</a> <a href="../graph.html">Graph view</a></nav>
${renderExplorationBar("../assets/", "../")}
${renderThemeSwitcher("../assets/")}
<p class="note-id"><code>${escapeHtml(node.id)}</code> <button type="button" class="copy-id" data-copy="${escapeHtml(node.id)}">Copy ID</button><span class="copy-id-feedback" aria-live="polite"></span> <button type="button" class="mark-read-button" data-mark-read="${escapeHtml(node.id)}" title="Mark as read" hidden>Mark as read</button></p>
<p class="note-dates">${updatedHtml}<span class="date-sep" data-read-sep hidden>·</span><span class="date-group" data-read-at hidden><span class="date-label">Read</span> <span class="date-value" data-read-value></span></span><span class="date-tz" data-tz></span></p>
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>enastro</title>
<link rel="stylesheet" href="assets/site.css">
${THEME_FOUC_SCRIPT}
</head>
<body>
<nav><a href="graph.html">Graph view</a></nav>
${renderExplorationBar("assets/", "")}
${renderThemeSwitcher("assets/")}
<header class="index-header">
<h1>Notes</h1>
<input type="search" id="search-box" placeholder="Search notes...">
<div id="tag-filters"></div>
</header>
<p id="no-results" hidden>No notes match the current search/filter.</p>
<ul id="note-list">${items}</ul>
<script type="module" src="assets/search.mjs"></script>
</body>
</html>
`;
}

/**
 * Assembles the Graph UI secondary page (REQ-GRAPH-004/005, REQ-UX-009,
 * ADR-0010, ADR-0011). No node/edge data is templated in server-side; the
 * client fetches the already-public `graph.json` at runtime and renders it
 * with `graph-view.mjs` (WebGL, via a vendored pixi.js build). The tag
 * filter UI (REQ-UX-002) is populated client-side by `graph-view.mjs` once
 * `graph.json` has loaded, mirroring the All Notes page's tag filters.
 */
export function renderGraphPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>enastro · Graph view</title>
<link rel="stylesheet" href="assets/site.css">
${THEME_FOUC_SCRIPT}
</head>
<body class="graph-shell">
<div class="graph-header">
<nav><a href="index.html">All notes</a></nav>
<div id="tag-filters"></div>
</div>
${renderExplorationBar("assets/", "")}
${renderThemeSwitcher("assets/")}
<div id="graph-canvas-container"></div>
<p id="graph-status" class="graph-status" role="status"></p>
<script type="module" src="assets/graph-view.mjs"></script>
</body>
</html>
`;
}
