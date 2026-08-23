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

const ACCENT = 0x7dd3fc;
const ACCENT_STRONG = 0xa78bfa;
const EDGE_COLOR = 0x2a2f55;
const PARTICLE_COLOR = 0xe7e9f5;

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

  const app = new PIXI.Application();
  await app.init({ resizeTo: container, backgroundAlpha: 0, antialias: true });
  container.appendChild(app.canvas);

  const world = new PIXI.Container();
  app.stage.addChild(world);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const degreeById = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1);
    degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1);
  }
  const maxDegree = Math.max(1, ...degreeById.values());

  // Edges are drawn first, as a single batched Graphics object, so they sit
  // beneath nodes/particles.
  const edgesLayer = new PIXI.Graphics();
  world.addChild(edgesLayer);
  const validEdges = [];
  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    validEdges.push({ source, target });
    edgesLayer.moveTo(source.x, source.y).lineTo(target.x, target.y);
  }
  edgesLayer.stroke({ width: 1, color: EDGE_COLOR, alpha: 0.5 });

  // One energy particle per edge, animated from source -> target (the
  // wikilink/embed direction) and looping.
  const particleLayer = new PIXI.Container();
  world.addChild(particleLayer);
  const particles = validEdges.map(({ source, target }) => {
    const dot = new PIXI.Graphics().circle(0, 0, 1.5).fill({ color: PARTICLE_COLOR, alpha: 0.9 });
    dot.x = source.x;
    dot.y = source.y;
    particleLayer.addChild(dot);
    return { dot, source, target, t: Math.random() };
  });

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    for (const particle of particles) {
      particle.t = (particle.t + dt * PARTICLE_SPEED) % 1;
      particle.dot.x = particle.source.x + (particle.target.x - particle.source.x) * particle.t;
      particle.dot.y = particle.source.y + (particle.target.y - particle.source.y) * particle.t;
    }
  });

  const nodesLayer = new PIXI.Container();
  world.addChild(nodesLayer);
  for (const node of graph.nodes) {
    const degree = degreeById.get(node.id) ?? 0;
    const radius = MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * Math.sqrt(degree / maxDegree);
    const color = degree > maxDegree * 0.5 ? ACCENT_STRONG : ACCENT;

    const star = new PIXI.Graphics().circle(0, 0, radius).fill({ color, alpha: 0.95 });
    star.x = node.x;
    star.y = node.y;
    star.eventMode = "static";
    star.cursor = "pointer";
    star.on("pointerover", () => {
      star.scale.set(1.6);
      if (status) status.textContent = node.title;
    });
    star.on("pointerout", () => {
      star.scale.set(1);
      if (status) status.textContent = "";
    });
    star.on("pointertap", () => {
      window.location.href = `notes/${encodeURIComponent(node.id)}.html`;
    });
    nodesLayer.addChild(star);
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
