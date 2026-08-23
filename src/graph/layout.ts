import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { PublicEdge, PublicNode } from "../projection/types.js";

export interface NodePosition {
  x: number;
  y: number;
}

interface SimNode {
  id: string;
  x?: number;
  y?: number;
}

/** Deterministic tick count for the build-time force simulation (no timers,
 * no randomness): running a fixed number of ticks keeps `enastro build`'s
 * output byte-identical across runs given the same input (REQ-BUILD-001). */
const TICK_COUNT = 300;

/**
 * Precomputes a force-directed layout for the public projection, at build
 * time, over the public (already-filtered) node/edge set only — never the
 * full/local graph (REQ-PUB-002, ADR-0010, ADR-0012). The result is a plain
 * `id -> {x, y}` map to be merged into `graph.json`'s per-node entries.
 *
 * d3-force's default node initialization (nodes placed on a spiral by index,
 * see d3-force's `initializeNodes`) and its force/tick math are both fully
 * deterministic given the same input order — no `Math.random()` is used —
 * so this function's output is stable across repeated builds.
 */
export function computeGraphLayout(
  nodes: readonly PublicNode[],
  edges: readonly PublicEdge[],
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  if (nodes.length === 0) {
    return positions;
  }

  const simNodes: SimNode[] = nodes.map((node) => ({ id: node.id }));
  const simLinks = edges.map((edge) => ({ source: edge.source, target: edge.target }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string }>(simLinks)
        .id((node) => node.id)
        .distance(40)
        .strength(0.3),
    )
    .force("charge", forceManyBody().strength(-60))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(12))
    .stop();

  for (let i = 0; i < TICK_COUNT; i++) {
    simulation.tick();
  }

  for (const node of simNodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }

  return positions;
}
