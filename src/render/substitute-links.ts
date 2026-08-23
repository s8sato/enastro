import type { KnowledgeGraph } from "../graph/types.js";
import { buildResolutionIndex, resolveTarget } from "../graph/resolve.js";
import { splitCodeSegments } from "../parser/code-blocks.js";

const WIKILINK_PATTERN = /(!)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

export interface SubstituteLinksResult {
  text: string;
  /** Targets removed because they resolved to an unpublished note. */
  removedTargets: string[];
}

/**
 * Replaces `[[wikilink]]` / `![[embed]]` occurrences in a note body with
 * their rendered form, according to the target's resolution/publish state:
 *
 * - resolved + public  -> a Markdown link to the published note.
 * - resolved + private -> the occurrence is deleted entirely, including the
 *   author-supplied display text, since the display text itself may leak
 *   private information (ADR-0002, REQ-SEC-001). No trace is left behind.
 * - unresolved / ambiguous-alias -> rendered as plain text inside a
 *   `.broken-link` span (REQ-CONTENT-007). This is safe because no private
 *   note's identity is exposed by a broken link.
 *
 * Code spans/fences are left untouched.
 */
export function substituteLinks(body: string, graph: KnowledgeGraph): SubstituteLinksResult {
  const index = buildResolutionIndex(graph.nodes);
  const publishById = new Map(graph.nodes.map((node) => [node.id, node.publish]));
  const removedTargets: string[] = [];

  const text = splitCodeSegments(body)
    .map((segment) => {
      if (segment.code) {
        return segment.text;
      }

      return segment.text.replace(WIKILINK_PATTERN, (_match, _embedMarker, rawTarget, rawDisplay) => {
        const target = (rawTarget as string).trim();
        const display = (rawDisplay as string | undefined)?.trim();
        const result = resolveTarget(target, index);

        if (result.status === "resolved") {
          if (publishById.get(result.nodeId)) {
            const label = display ?? target;
            return `[${label}](notes/${result.nodeId}.html)`;
          }

          removedTargets.push(target);
          return "";
        }

        const label = display ?? target;
        return `<span class="broken-link">${label}</span>`;
      });
    })
    .join("");

  return { text, removedTargets };
}
