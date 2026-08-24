/**
 * Graph UI (REQ-GRAPH-004/005, REQ-UX-009/010, ADR-0010, ADR-0011): renders
 * `graph.json` as a starfield of nodes ("stars") connected by edges, with a
 * small animated "energy particle" travelling along each edge in its
 * (wikilink/embed) direction. Runs directly in the browser as an ES module;
 * no bundler/build step needed — pixi.js is vendored as a single
 * self-contained ESM bundle (`pixi.min.mjs`, copied from the `pixi.js` npm
 * package at build time, see `src/build/site.ts`).
 *
 * Node/edge layout (x/y) is precomputed at build time (ADR-0006/0010/0012)
 * via a deterministic force simulation over the public projection only; this
 * script never computes or requests any layout itself, and never fetches
 * anything other than the already-public `graph.json`.
 *
 * This is a from-scratch reimplementation for enastro, not a port of any
 * other project's code — Foam's graph view (foam-graph) was used only as a
 * conceptual/UX reference (pan/zoom/hover/click, particle-on-edge idea), per
 * the user's explicit instruction (ADR-0010).
 */
import * as PIXI from "./pixi.min.mjs";
import { filterEntries } from "./filter.mjs";
import { getStatusSnapshot } from "./exploration.mjs";

// Color palette mirrors site.css's design tokens (`--accent`, `--nebula`,
// `--border`, `--fg`) so the Graph UI feels visually continuous with the
// rest of the site, and follows whichever of the 12 themes (REQ-UX-011) is
// currently active rather than a single hardcoded palette. graph-view.mjs
// is a standalone canvas renderer (pixi.js draw calls take numeric colors,
// not CSS `var()`), so colors are read from the live, fully-resolved CSS
// custom property values via `resolveCssColor()` below, and re-read
// whenever `data-theme` changes (see the MutationObserver near the bottom
// of `main()`). The hex literals here are only fallbacks for the unlikely
// case a token can't be resolved (e.g. no `document.body` yet).
const ACCENT_FALLBACK = 0xf2c879; // starlight gold, matches --accent (Moon theme)
const EDGE_COLOR_FALLBACK = 0x1d2044; // matches --border
const PARTICLE_COLOR_FALLBACK = 0xeae8f2; // matches --fg
const EXPLORED_COLOR_FALLBACK = 0x8b8fb0; // matches --fg-muted; used to dim/desaturate "read" notes (REQ-EXPLORE-005)
const LABEL_PRIMARY_COLOR_FALLBACK = 0xeae8f2; // matches --fg, achromatic (no accent hue)
const LABEL_NEIGHBOR_COLOR_FALLBACK = 0x8b8fb0; // matches --fg-muted, achromatic

// A single hidden probe element used to resolve a CSS custom property to
// its final, computed color (`getComputedStyle` never resolves a custom
// property's own value, e.g. a `color-mix()` expression, but it always
// fully resolves a real property like `color` that merely *references*
// one via `var()`). A 1x1 canvas then converts that computed color string
// to concrete sRGB bytes: modern browsers may serialize a computed color
// in formats other than `rgb(...)` (e.g. `oklab(...)`), and canvas
// `fillStyle` accepts (and normalizes) any valid CSS `<color>` syntax, so
// parsing via canvas is robust to that instead of regex-matching `rgb()`.
let colorProbe;
let colorCanvasCtx;

/**
 * @param {string} cssVarName e.g. "--accent"
 * @param {number} fallback hex color used if the variable can't be resolved
 */
function resolveCssColor(cssVarName, fallback) {
  if (!colorProbe) {
    colorProbe = document.createElement("div");
    colorProbe.style.position = "absolute";
    colorProbe.style.visibility = "hidden";
    colorProbe.style.pointerEvents = "none";
    document.body.appendChild(colorProbe);
  }
  if (!colorCanvasCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorCanvasCtx = canvas.getContext("2d");
  }
  colorProbe.style.color = `var(${cssVarName})`;
  const resolved = getComputedStyle(colorProbe).color;
  try {
    colorCanvasCtx.fillStyle = resolved;
    colorCanvasCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = colorCanvasCtx.getImageData(0, 0, 1, 1).data;
    return (r << 16) | (g << 8) | b;
  } catch {
    return fallback;
  }
}

/** Re-reads all theme-dependent colors from the current `data-theme`. */
function readThemeColors() {
  return {
    accent: resolveCssColor("--accent", ACCENT_FALLBACK),
    edge: resolveCssColor("--border", EDGE_COLOR_FALLBACK),
    particle: resolveCssColor("--fg", PARTICLE_COLOR_FALLBACK),
    explored: resolveCssColor("--fg-muted", EXPLORED_COLOR_FALLBACK),
    labelPrimary: resolveCssColor("--fg", LABEL_PRIMARY_COLOR_FALLBACK),
    labelNeighbor: resolveCssColor("--fg-muted", LABEL_NEIGHBOR_COLOR_FALLBACK),
  };
}

const MIN_NODE_RADIUS = 3;
const MAX_NODE_RADIUS = 10;
/** Particle travel speed, in edge-lengths-per-second (visual only). */
const PARTICLE_SPEED = 0.25;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const FIT_PADDING_PX = 80;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function main() {
  const container = document.getElementById("graph-canvas-container");
  const status = document.getElementById("graph-status");
  const tagFilters = document.getElementById("tag-filters");
  if (!container) {
    return;
  }

  /** @type {{nodes: {id: string, title: string, tags: string[], x: number, y: number}[], edges: {source: string, target: string, kind: string}[]}} */
  let graph;
  try {
    const response = await fetch("graph.json");
    graph = await response.json();
  } catch {
    if (status) status.textContent = "Failed to load graph data.";
    return;
  }

  if (!graph.nodes || graph.nodes.length === 0) {
    if (status) status.textContent = "This vault has no published notes yet.";
    return;
  }

  let colors = readThemeColors();

  const app = new PIXI.Application();
  // Explicit resolution (defaults to 1 otherwise, which renders text/node
  // outlines blurry on high-DPI mobile screens) + autoDensity so the
  // canvas's CSS size still matches its container while the backing
  // bitmap is rendered at the device's native pixel density.
  await app.init({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  container.appendChild(app.canvas);

  const world = new PIXI.Container();
  app.stage.addChild(world);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const degreeById = new Map(graph.nodes.map((node) => [node.id, 0]));
  const neighborsById = new Map(graph.nodes.map((node) => [node.id, new Set()]));
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1);
    degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1);
    neighborsById.get(edge.source).add(edge.target);
    neighborsById.get(edge.target).add(edge.source);
  }
  const maxDegree = Math.max(1, ...degreeById.values());

  // Edges are drawn first, as a single batched Graphics object, so they sit
  // beneath nodes/particles. Redrawn whenever the tag filter (REQ-UX-002)
  // changes, since a filtered-out node's edges must disappear along with it.
  const edgesLayer = new PIXI.Graphics();
  world.addChild(edgesLayer);
  const validEdges = [];
  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    validEdges.push({ source, target });
  }

  /** @type {Set<string>} ids of nodes currently matching the tag filter (all nodes when no tags are selected). */
  let activeNodeIds = new Set(graph.nodes.map((node) => node.id));

  function redrawEdges() {
    edgesLayer.clear();
    for (const { source, target } of validEdges) {
      if (!activeNodeIds.has(source.id) || !activeNodeIds.has(target.id)) continue;
      edgesLayer.moveTo(source.x, source.y).lineTo(target.x, target.y);
    }
    edgesLayer.stroke({ width: 1, color: colors.edge, alpha: 0.5 });
  }
  redrawEdges();

  // Redrawn on hover only, to highlight the edges connected to the hovered
  // node (REQ-UX-009's "adjacent nodes/edges should stand out" feedback).
  // Highlighting is thickness-only — same hue as the normal edges — so the
  // effect reads as "these edges matter right now" without recoloring or
  // otherwise changing the graph's palette.
  const highlightEdgesLayer = new PIXI.Graphics();
  world.addChild(highlightEdgesLayer);

  // One energy particle per edge, animated from source -> target (the
  // wikilink/embed direction). All particles share a single global clock
  // (rather than each looping independently on its own, previously
  // randomized, phase) so every edge fires its particle in sync — the
  // whole graph "pulses" together instead of looking like scattered,
  // independent traffic.
  const particleLayer = new PIXI.Container();
  world.addChild(particleLayer);
  const particles = validEdges.map(({ source, target }) => {
    const dot = new PIXI.Graphics().circle(0, 0, 1.5).fill({ color: colors.particle, alpha: 0.9 });
    dot.x = source.x;
    dot.y = source.y;
    particleLayer.addChild(dot);
    return { dot, source, target };
  });

  let particleCycleT = 0;
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    particleCycleT = (particleCycleT + dt * PARTICLE_SPEED) % 1;
    for (const particle of particles) {
      if (!particle.dot.visible) continue;
      particle.dot.x = particle.source.x + (particle.target.x - particle.source.x) * particleCycleT;
      particle.dot.y = particle.source.y + (particle.target.y - particle.source.y) * particleCycleT;
    }
  });

  const nodesLayer = new PIXI.Container();
  world.addChild(nodesLayer);
  const starById = new Map();
  for (const node of graph.nodes) {
    const degree = degreeById.get(node.id) ?? 0;
    const radius = MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * Math.sqrt(degree / maxDegree);

    const star = new PIXI.Graphics().circle(0, 0, radius).fill({ color: colors.accent, alpha: 0.95 });
    star.x = node.x;
    star.y = node.y;
    star.eventMode = "static";
    star.cursor = "pointer";
    nodesLayer.addChild(star);
    starById.set(node.id, star);
  }

  // Exploration status (REQ-EXPLORE-005): notes marked "read" (tracked
  // entirely client-side in localStorage by exploration.mjs) render as
  // dimmed/desaturated stars, and the energy particles they emit are
  // dimmed to match — never colored/persisted server-side, and looked up
  // purely by id so it's unaffected by which nodes/edges currently exist
  // (REQ-EXPLORE-004).
  let exploredIds = new Set(
    [...getStatusSnapshot()].filter(([, status]) => status === "read").map(([id]) => id),
  );

  function applyExploration() {
    for (const node of graph.nodes) {
      const star = starById.get(node.id);
      if (!star) continue;
      const degree = degreeById.get(node.id) ?? 0;
      const radius = MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * Math.sqrt(degree / maxDegree);
      const isExplored = exploredIds.has(node.id);
      star.clear();
      star.circle(0, 0, radius).fill({ color: isExplored ? colors.explored : colors.accent, alpha: isExplored ? 0.5 : 0.95 });
    }
    for (const particle of particles) {
      const isExplored = exploredIds.has(particle.source.id);
      particle.dot.clear();
      particle.dot.circle(0, 0, 1.5).fill({ color: isExplored ? colors.explored : colors.particle, alpha: isExplored ? 0.4 : 0.9 });
    }
  }
  applyExploration();

  window.addEventListener("enastro:exploration-changed", (event) => {
    exploredIds = new Set(
      [...event.detail.statusById].filter(([, status]) => status === "read").map(([id]) => id),
    );
    applyExploration();
  });

  // Theme switcher (REQ-UX-011) sets `data-theme` on <html> synchronously,
  // including live hover-preview before a choice is committed — re-resolve
  // colors and redraw whenever it changes, so the graph tracks the switcher
  // just like the rest of the (CSS-driven) page does.
  new MutationObserver(() => {
    colors = readThemeColors();
    redrawEdges();
    applyExploration();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Hover titles are rendered as floating labels next to each relevant node
  // (rather than aggregated in the bottom-left status bar), in screen space
  // (a sibling of `world`, not a child of it) so their font size stays
  // constant regardless of the current pan/zoom level.
  const labelsLayer = new PIXI.Container();
  app.stage.addChild(labelsLayer);
  const labelByNodeId = new Map();
  // Hub nodes can have dozens of neighbors; showing a label for every one of
  // them at once is unreadable, so only the most-connected neighbors get a
  // label (REQ-UX-009 hover feedback should stay legible even for hubs).
  const MAX_NEIGHBOR_LABELS = 10;

  function nodeScreenPosition(node) {
    return { x: world.position.x + node.x * world.scale.x, y: world.position.y + node.y * world.scale.y };
  }

  function nodeRadius(node) {
    return MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * Math.sqrt((degreeById.get(node.id) ?? 0) / maxDegree);
  }

  /**
   * A label is placed on the side of its node facing away from `awayFrom`
   * (world-space coordinates), so neighbor labels fan outward from the
   * hovered hub instead of all converging toward it and overlapping.
   */
  function showLabel(node, { primary, awayFrom }) {
    if (labelByNodeId.has(node.id)) return;

    const dirX = awayFrom ? node.x - awayFrom.x : 1;
    const facingLeft = dirX < 0;

    const text = new PIXI.Text({
      text: node.title,
      style: {
        // Matches --font-display / note titles (h1/h2) in site.css, so the
        // floating graph labels read as the same "note title" typography
        // used elsewhere on the site.
        fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
        fontSize: primary ? 18 : 15,
        fontWeight: primary ? "700" : "400",
        fill: primary ? colors.labelPrimary : colors.labelNeighbor,
      },
    });
    text.anchor.set(facingLeft ? 1 : 0, 0.5);

    // A translucent backing board so the label stays legible when it
    // overlaps an edge, particle, or another node.
    const padding = { x: 5, y: 2 };
    const board = new PIXI.Graphics();
    const bounds = text.getLocalBounds();
    board
      .roundRect(bounds.x - padding.x, bounds.y - padding.y, bounds.width + padding.x * 2, bounds.height + padding.y * 2, 4)
      .fill({ color: 0x06071a, alpha: 0.72 });

    const container = new PIXI.Container();
    container.addChild(board, text);
    container.eventMode = "none";
    labelsLayer.addChild(container);
    labelByNodeId.set(node.id, { node, container, facingLeft });
    repositionLabels();
  }

  function hideLabel(nodeId) {
    const entry = labelByNodeId.get(nodeId);
    if (!entry) return;
    labelsLayer.removeChild(entry.container);
    entry.container.destroy({ children: true });
    labelByNodeId.delete(nodeId);
  }

  function repositionLabels() {
    for (const { node, container, facingLeft } of labelByNodeId.values()) {
      const screenPos = nodeScreenPosition(node);
      const offset = (nodeRadius(node) * world.scale.x + 6) * (facingLeft ? -1 : 1);
      container.x = screenPos.x + offset;
      container.y = screenPos.y;
    }
  }
  app.ticker.add(() => {
    if (labelByNodeId.size > 0) repositionLabels();
  });

  const neighborIdsByNodeId = new Map(
    graph.nodes.map((node) => [
      node.id,
      [...(neighborsById.get(node.id) ?? [])]
        .sort((a, b) => (degreeById.get(b) ?? 0) - (degreeById.get(a) ?? 0))
        .slice(0, MAX_NEIGHBOR_LABELS),
    ]),
  );

  function highlightNode(node) {
    showLabel(node, { primary: true });
    highlightEdgesLayer.clear();
    for (const neighborId of neighborIdsByNodeId.get(node.id) ?? []) {
      const neighborStar = starById.get(neighborId);
      const neighborNode = nodeById.get(neighborId);
      if (!neighborStar || !neighborNode) continue;
      showLabel(neighborNode, { primary: false, awayFrom: node });
      highlightEdgesLayer.moveTo(node.x, node.y).lineTo(neighborStar.x, neighborStar.y);
    }
    highlightEdgesLayer.stroke({ width: 3, color: colors.edge, alpha: 0.9 });
  }

  function clearHighlight(node) {
    hideLabel(node.id);
    for (const neighborId of neighborIdsByNodeId.get(node.id) ?? []) {
      hideLabel(neighborId);
    }
    highlightEdgesLayer.clear();
  }

  // On touch devices there's no real "hover": a tap fires pointerover then
  // immediately pointertap-and-navigate on release, so the title never has
  // a chance to be read (and the finger itself covers the node while
  // pressed). So on touch/pen, the *first* tap on a node only previews it
  // (same highlight as desktop hover) without navigating; a second tap on
  // the already-previewed node navigates. Tapping a different node swaps
  // the preview to that node. The preview is intentionally NOT cleared by
  // tapping empty space or by panning/zooming, since on mobile there's no
  // other way to keep a node's title visible while inspecting the graph.
  // Mouse pointerover/pointerout (real hover) and click-to-navigate are
  // unaffected.
  let armedTouchNodeId = null;

  for (const node of graph.nodes) {
    const star = starById.get(node.id);

    star.on("pointerover", (event) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      highlightNode(node);
    });
    star.on("pointerout", (event) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      clearHighlight(node);
    });
    star.on("pointertap", (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        window.location.href = `notes/${encodeURIComponent(node.id)}.html`;
        return;
      }
      if (armedTouchNodeId === node.id) {
        window.location.href = `notes/${encodeURIComponent(node.id)}.html`;
        return;
      }
      if (armedTouchNodeId) {
        const previousNode = nodeById.get(armedTouchNodeId);
        if (previousNode) clearHighlight(previousNode);
      }
      armedTouchNodeId = node.id;
      highlightNode(node);
    });
  }

  /** Maps a screen-space point (canvas-relative) to a point in `world` space. */
  function screenToWorld(point) {
    return {
      x: (point.x - world.position.x) / world.scale.x,
      y: (point.y - world.position.y) / world.scale.y,
    };
  }

  /** Positions/scales `world` so that `worldPoint` lands exactly at `screenPoint`. */
  function applyViewport(screenPoint, worldPoint, scale) {
    world.scale.set(scale);
    world.position.set(screenPoint.x - worldPoint.x * scale, screenPoint.y - worldPoint.y * scale);
  }

  function fitToView() {
    const xs = graph.nodes.map((n) => n.x);
    const ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = clamp(
      Math.min(
        (app.screen.width - FIT_PADDING_PX * 2) / width,
        (app.screen.height - FIT_PADDING_PX * 2) / height,
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const centerWorld = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const centerScreen = { x: app.screen.width / 2, y: app.screen.height / 2 };
    applyViewport(centerScreen, centerWorld, Number.isFinite(scale) ? scale : 1);
  }

  fitToView();

  // Tag filter UI (REQ-UX-002), mirroring the All Notes page's tag pills:
  // selecting one or more tags hides every node that doesn't have *all* of
  // them (AND semantics, via the shared filterEntries() logic), along with
  // that node's edges and edge particles.
  if (tagFilters) {
    const allTags = [...new Set(graph.nodes.flatMap((node) => node.tags))].sort();

    for (const tag of allTags) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tag = tag;
      button.setAttribute("aria-pressed", "false");
      button.textContent = `#${tag}`;
      button.addEventListener("click", () => {
        button.setAttribute("aria-pressed", button.getAttribute("aria-pressed") === "true" ? "false" : "true");
        applyFilter();
      });
      tagFilters.appendChild(button);
    }
  }

  function selectedTags() {
    if (!tagFilters) return [];
    return [...tagFilters.querySelectorAll('[aria-pressed="true"]')].map((button) => button.dataset.tag);
  }

  function applyFilter() {
    const entries = graph.nodes.map((node) => ({ id: node.id, title: node.title, tags: node.tags, text: "", modifiedAt: "" }));
    activeNodeIds = new Set(filterEntries(entries, "", selectedTags()));

    for (const node of graph.nodes) {
      const star = starById.get(node.id);
      const isActive = activeNodeIds.has(node.id);
      star.visible = isActive;
      if (!isActive) {
        if (armedTouchNodeId === node.id) armedTouchNodeId = null;
        clearHighlight(node);
      }
    }

    redrawEdges();

    for (const particle of particles) {
      particle.dot.visible = activeNodeIds.has(particle.source.id) && activeNodeIds.has(particle.target.id);
    }
  }

  // Exposes each node's current on-screen position, purely for E2E test
  // instrumentation (see src/e2e/graph-ui.e2e.test.ts) — pan/zoom moves
  // `world`, so a node's screen position isn't otherwise queryable from
  // outside this module. Reads only already-public graph.json data.
  window.__enastroGraph = {
    getNodeScreenPosition(id) {
      const node = nodeById.get(id);
      if (!node) return null;
      return {
        x: world.position.x + node.x * world.scale.x,
        y: world.position.y + node.y * world.scale.y,
      };
    },
    // Exploration status (REQ-EXPLORE-005), for E2E test instrumentation
    // (see src/e2e/exploration.e2e.test.ts) — dimming is only visible as a
    // rendered fill color, which pixel inspection would make brittle.
    isExplored(id) {
      return exploredIds.has(id);
    },
    // Theme switcher (REQ-UX-011), for E2E test instrumentation (see
    // src/e2e/theme-switcher.e2e.test.ts) — the star's fill color is only
    // ever set via a pixi.js draw call (not CSS), so it isn't otherwise
    // queryable from outside this module without brittle pixel inspection.
    getNodeColor(id) {
      const isExplored = exploredIds.has(id);
      return isExplored ? colors.explored : colors.accent;
    },
  };

  // Pan (1 pointer) and pinch-zoom (2 pointers), unified: at the start of
  // each gesture we remember the world-space point currently under the
  // pointer (or under the 2-pointer midpoint), then keep that point pinned
  // under the pointer/midpoint as it moves (REQ-UX-010).
  const activePointers = new Map();
  let anchorWorld = null;
  let anchorScale = 1;
  let pinchStartDistance = 1;

  function midpoint(points) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function canvasPoint(event) {
    const rect = app.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginGesture() {
    const points = [...activePointers.values()];
    anchorScale = world.scale.x;
    if (points.length === 1) {
      anchorWorld = screenToWorld(points[0]);
    } else if (points.length >= 2) {
      const [a, b] = points;
      pinchStartDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      anchorWorld = screenToWorld(midpoint([a, b]));
    }
  }

  app.canvas.addEventListener("pointerdown", (event) => {
    app.canvas.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, canvasPoint(event));
    beginGesture();
  });

  app.canvas.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, canvasPoint(event));
    const points = [...activePointers.values()];
    if (!anchorWorld) return;

    if (points.length === 1) {
      applyViewport(points[0], anchorWorld, world.scale.x);
    } else if (points.length >= 2) {
      const [a, b] = points;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const scale = clamp(anchorScale * (distance / pinchStartDistance), MIN_ZOOM, MAX_ZOOM);
      applyViewport(midpoint([a, b]), anchorWorld, scale);
    }
  });

  function endPointer(event) {
    activePointers.delete(event.pointerId);
    if (activePointers.size > 0) {
      beginGesture();
    } else {
      anchorWorld = null;
    }
  }
  app.canvas.addEventListener("pointerup", endPointer);
  app.canvas.addEventListener("pointercancel", endPointer);
  app.canvas.addEventListener("pointerleave", endPointer);

  app.canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const point = canvasPoint(event);
      const worldPoint = screenToWorld(point);
      const scale = clamp(world.scale.x * Math.exp(-event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
      applyViewport(point, worldPoint, scale);
    },
    { passive: false },
  );

  // Signals the "first interactive frame" (ADR-0012's operational
  // definition: the first `requestAnimationFrame` after the precomputed
  // layout has painted) via a DOM attribute a perf harness can poll for.
  requestAnimationFrame(() => {
    document.body.dataset.graphInteractive = "true";
  });
}

main();
