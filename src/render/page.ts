import type { PublicNode } from "../projection/types.js";
import { escapeHtml } from "./escape-html.js";

/**
 * Vault-level build-time defaults (ADR-0016) baked into each page: the
 * viewer's own stored choice (`localStorage`) always takes precedence over
 * these, and these are never themselves written to any build artifact
 * beyond the initial HTML they're embedded in (REQ-UX-011/012/013).
 */
export interface RenderSiteConfig {
  /** `enastro.config.json`'s `siteTitle` (default `"Notes"`). Applied to
   * the All Notes page's `<h1>`/`<title>` and the Graph view's `<title>`;
   * note pages keep their own note title. */
  siteTitle: string;
  /** `enastro.config.json`'s `defaultTheme` (default `"moon"`), used only
   * when no theme is yet stored in `localStorage`. */
  defaultTheme: string;
  /** `enastro.config.json`'s `defaultParticleDirection` (default
   * `"wikilink"`), used only on the graph page (`graph/`), and only when no direction is
   * yet stored in `localStorage`. */
  defaultParticleDirection: "wikilink" | "backlink";
}

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
  siteConfig: RenderSiteConfig;
}

/**
 * Markup for the History drawer's trigger button (REQ-EXPLORE-003),
 * meant to be embedded directly inside each page kind's `<nav>` (rather
 * than floating, as it used to) — `margin-left: auto` (site.css) pushes it
 * to the nav's right edge. Hidden by default and revealed by
 * exploration.mjs (progressive enhancement, same pattern as
 * local-time.mjs); without JavaScript it simply stays invisible and inert,
 * since there is nothing for it to open.
 */
function renderExplorationTrigger(): string {
  return `<button type="button" id="exploration-rewind-toggle" hidden>HISTORY</button>`;
}

/**
 * Markup for a single `<nav>` item: either a real link, or (when `href`
 * refers to the current page itself) an inert `<span aria-current="page">`
 * with the same label/position. Used so every page kind's nav shows the
 * exact same item set in the exact same order (`renderNav()` below) —
 * previously each page kind silently omitted its own self-link, which
 * shifted the remaining items (and the visual identity of the nav's
 * leftmost slot) relative to the other two page kinds.
 */
function renderNavItem(href: string, label: string, isCurrent: boolean): string {
  return isCurrent ? `<span aria-current="page">${label}</span>` : `<a href="${href}">${label}</a>`;
}

/**
 * Shared `<nav>` markup for all three page kinds: always `All notes` →
 * `Graph view` → the History trigger, in that fixed order/position
 * (REQ-UX-009's history drawer position invariant relies on this). The
 * page kind matching `current` renders its own item as a non-clickable
 * `aria-current="page"` label instead of a link, rather than omitting it,
 * so the nav's layout never changes shape across page kinds.
 *
 * `graphHref` for note pages includes a `?focus=<id>` query param (see
 * `renderNotePage()`) so graph-view.mjs can pan/zoom to and highlight the
 * note the viewer came from.
 */
function renderNav(current: "index" | "note" | "graph", allNotesHref: string, graphHref: string): string {
  return `<nav>${renderNavItem(allNotesHref, "All notes", current === "index")} ${renderNavItem(graphHref, "Graph view", current === "graph")}${renderExplorationTrigger()}</nav>`;
}

/**
 * Markup for the exploration-status History drawer (REQ-EXPLORE-003),
 * shared across all three page kinds. Hidden by default and
 * populated/revealed by exploration.mjs (progressive enhancement, same
 * pattern as local-time.mjs); without JavaScript it simply stays invisible
 * and inert. The trigger button that opens this drawer lives separately,
 * inside each page's `<nav>` — see `renderExplorationTrigger()`.
 *
 * `rootPrefix` is the relative path back to the site root (e.g. `"../../"` for
 * note pages, `"../"` for the graph page, `""` for the index page — depths
 * per ADR-0018's clean URL structure) — needed so exploration.mjs can
 * fetch the already-public `search-index.json` (for ID-mismatch detection
 * and stale-read detection, REQ-EXPLORE-006/007) regardless of which page
 * kind it's running on.
 *
 * Layout (REQ-UX / history-drawer mock): a translucent right-edge sliding
 * panel (`#exploration-rewind-panel`) with its own scrim
 * (`#exploration-drawer-scrim`), positioned *below* the header rather than
 * covering it — exploration.mjs measures the header's real height at
 * runtime and sets both elements' `top` accordingly, since it differs
 * between page kinds (the graph page's `.graph-header` includes a
 * variable-height tag-filter row that plain `<nav>` doesn't have).
 *
 * The 3 rewind actions are ordered by increasing risk/irreversibility:
 * Return (safe) → Squash (destructive but preserves net read/unread effect) →
 * Reset (destructive and can discard real history). All 3 stay visible at
 * all times rather than appearing only once a past point is selected.
 * Return is always enabled (returning to "now" is safe/idempotent even
 * while already live); Squash/Reset start `disabled` (exploration.mjs's
 * `update()` keeps them that way while live, since both require a rewound
 * cursor to act on).
 */
function renderExplorationBar(assetsPrefix: string, rootPrefix: string): string {
  return `<div id="exploration-bar" class="exploration-bar" data-search-index-href="${rootPrefix}search-index.json" hidden>
<div id="exploration-drawer-scrim"></div>
<div id="exploration-rewind-panel" hidden>
<button type="button" id="exploration-drawer-close" aria-label="Close history">✕</button>
<p id="exploration-storage-warning" class="exploration-warning" hidden><span class="exploration-icon" aria-hidden="true"></span><span data-text></span></p>
<p id="exploration-missing-notice" class="exploration-notice" hidden><span class="exploration-icon" aria-hidden="true"></span><span data-text></span></p>
<p id="exploration-auto-unread-notice" class="exploration-notice" hidden><span class="exploration-icon" aria-hidden="true"></span><span data-text></span></p>
<button type="button" id="exploration-return-to-now">Return to now</button>
<button type="button" id="exploration-squash-here" disabled>Squash until here</button>
<button type="button" id="exploration-reset-here" disabled>Reset to here</button>
<ul id="exploration-history-list"></ul>
</div>
</div>
<script type="module" src="${assetsPrefix}exploration.mjs"></script>`;
}

/**
 * FOUC-prevention script for the theme switcher (REQ-UX-011). Small,
 * inline, and *not* externalized (unlike the module scripts below) so it
 * runs synchronously before first paint: it reads the persisted theme
 * choice from `localStorage`, falling back to the vault's build-time
 * `defaultTheme` (`enastro.config.json`, ADR-0016) when nothing is stored
 * yet, and applies `data-theme` to `<html>` immediately, before `site.css`
 * would otherwise paint the default (Moon) theme. Without JavaScript (or
 * before it runs), the page simply renders in the Moon theme — the same
 * progressive-enhancement approach as `local-time.mjs`. `theme-switcher.mjs`
 * itself doesn't need to know about `defaultTheme` separately: it already
 * falls back to whatever `data-theme` this script applied
 * (`document.documentElement.dataset.theme`) before its own hardcoded
 * default.
 */
function themeFoucScript(defaultTheme: string): string {
  return `<script>(function(){try{var t=localStorage.getItem("enastro:theme:v1");document.documentElement.dataset.theme=t||${JSON.stringify(defaultTheme)};}catch(e){}})();</script>`;
}

/**
 * Markup for the theme switcher trigger (REQ-UX-011), shared across all
 * three page kinds. Deliberately kept independent of `<nav>` (rather than
 * a nav link) and styled as a small floating widget fixed to the
 * bottom-left corner, so it doesn't compete with the page's nav/tag-filter
 * chrome. The actual dial/select UI is built by theme-switcher.mjs
 * (progressive enhancement); without JavaScript only the inert trigger
 * button exists.
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
  const { node, bodyHtml, backlinks, modifiedAt, modifiedAtEpochMs, siteConfig } = params;

  const tagsHtml = node.tags.length
    ? `<ul class="tags">${node.tags
        .map(
          (tag) =>
            `<li><a href="../../?tags=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a></li>`,
        )
        .join("")}</ul>`
    : "";

  const backlinksHtml = backlinks.length
    ? `<section class="backlinks"><h2>Backlinks</h2><ul>${backlinks
        .map((b) => `<li><a href="../${b.id}/">${escapeHtml(b.title)}</a></li>`)
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
<link rel="stylesheet" href="../../assets/site.css">
<link rel="stylesheet" href="../../assets/katex/katex.min.css">
${themeFoucScript(siteConfig.defaultTheme)}
</head>
<body>
${renderNav("note", "../../", `../../graph/?focus=${encodeURIComponent(node.id)}`)}
${renderExplorationBar("../../assets/", "../../")}
${renderThemeSwitcher("../../assets/")}
<p class="note-id"><code>${escapeHtml(node.id)}</code> <button type="button" class="copy-id" data-copy="${escapeHtml(node.id)}">Copy ID</button><span class="copy-id-feedback" aria-live="polite"></span> <button type="button" class="mark-read-button" data-mark-read="${escapeHtml(node.id)}" title="Mark as read" hidden>Mark as read</button></p>
<p class="note-dates">${updatedHtml}<span class="date-sep" data-read-sep hidden>·</span><span class="date-group" data-read-at hidden><span class="date-label">Read</span> <span class="date-value" data-read-value></span></span><span class="date-tz" data-tz></span></p>
${tagsHtml}
<article>${bodyHtml}</article>
${backlinksHtml}
<script type="module" src="../../assets/copy-id.mjs"></script>
<script type="module" src="../../assets/local-time.mjs"></script>
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
export function renderIndexPage(nodes: PublicNode[], siteConfig: RenderSiteConfig): string {
  const items = nodes
    .map(
      (node) =>
        `<li data-id="${escapeHtml(node.id)}"><a href="notes/${node.id}/">${escapeHtml(node.title)}</a></li>`,
    )
    .join("");
  const siteTitle = escapeHtml(siteConfig.siteTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${siteTitle}</title>
<link rel="stylesheet" href="assets/site.css">
${themeFoucScript(siteConfig.defaultTheme)}
</head>
<body>
${renderNav("index", "./", "graph/")}
${renderExplorationBar("assets/", "")}
${renderThemeSwitcher("assets/")}
<header class="index-header">
<h1>${siteTitle}</h1>
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
 * Assembles the Graph UI secondary page (REQ-GRAPH-004/005, REQ-UX-009/012,
 * ADR-0010, ADR-0011). No node/edge data is templated in server-side; the
 * client fetches the already-public `graph.json` at runtime and renders it
 * with `graph-view.mjs` (WebGL, via a vendored pixi.js build). The tag
 * filter UI (REQ-UX-002) is populated client-side by `graph-view.mjs` once
 * `graph.json` has loaded, mirroring the All Notes page's tag filters. The
 * `#particle-direction-toggle` button (REQ-UX-012) is similarly a hidden
 * progressive-enhancement placeholder, revealed and wired up by
 * `graph-view.mjs`/`particle-direction.mjs` — this page is graph-only, no
 * equivalent markup on index/note pages.
 */
export function renderGraphPage(siteConfig: RenderSiteConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(siteConfig.siteTitle)} · Graph view</title>
<link rel="stylesheet" href="../assets/site.css">
${themeFoucScript(siteConfig.defaultTheme)}
</head>
<body class="graph-shell">
<div class="graph-header">
${renderNav("graph", "../", "./")}
<div id="tag-filters"></div>
</div>
<button type="button" id="particle-direction-toggle" data-default-direction="${escapeHtml(siteConfig.defaultParticleDirection)}" hidden></button>
${renderExplorationBar("../assets/", "../")}
${renderThemeSwitcher("../assets/")}
<div id="graph-canvas-container"></div>
<p id="graph-status" class="graph-status" role="status"></p>
<script type="module" src="../assets/graph-view.mjs"></script>
</body>
</html>
`;
}
