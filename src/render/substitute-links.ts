import type { KnowledgeGraph } from "../graph/types.js";
import { buildResolutionIndex, resolveTarget } from "../graph/resolve.js";
import type { AttachmentFile } from "../vault/discover-attachments.js";
import { buildAttachmentResolutionIndex, resolveAttachmentTarget } from "../vault/resolve-attachment.js";
import { splitCodeSegments } from "../parser/code-blocks.js";

const WIKILINK_PATTERN = /(!)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

export interface SubstituteLinksOptions {
  /** Attachments discovered in the vault (REQ-PUB-006). */
  attachments?: AttachmentFile[];
  /** Vault-relative attachment ids allowed to be published (ADR-0003). */
  publishedAttachmentIds?: ReadonlySet<string>;
}

export interface SubstituteLinksResult {
  text: string;
  /** Targets removed because they resolved to an unpublished note or a non-allowlisted attachment. */
  removedTargets: string[];
}

/**
 * Replaces `[[wikilink]]` / `![[embed]]` occurrences in a note body with
 * their rendered form, according to the target's resolution/publish state:
 *
 * - resolved to a public note   -> a Markdown link to the published note.
 *   The display text is the author-supplied `|alias` if present, otherwise
 *   the target note's title (not its id/raw target text — ADR-0009: ids
 *   are for writing/resolving links, titles are for displaying them).
 * - resolved to a private note  -> the occurrence is deleted entirely,
 *   including the author-supplied display text, since the display text
 *   itself may leak private information (ADR-0002, REQ-SEC-001). No trace
 *   is left behind.
 * - resolved to an allowlisted attachment -> a Markdown image/link pointing
 *   at the copied attachment (REQ-PUB-006).
 * - resolved to a non-allowlisted attachment -> deleted entirely, same
 *   treatment as a private note (ADR-0003).
 * - unresolved / ambiguous -> rendered as plain text inside a
 *   `.broken-link` span (REQ-CONTENT-007). This is safe because no private
 *   note's or attachment's identity is exposed by a broken link.
 *
 * Code spans/fences are left untouched.
 */
export function substituteLinks(
  body: string,
  graph: KnowledgeGraph,
  options: SubstituteLinksOptions = {},
): SubstituteLinksResult {
  const index = buildResolutionIndex(graph.nodes);
  const publishById = new Map(graph.nodes.map((node) => [node.id, node.publish]));
  const titleById = new Map(graph.nodes.map((node) => [node.id, node.title]));
  const attachmentIndex = buildAttachmentResolutionIndex(options.attachments ?? []);
  const publishedAttachmentIds = options.publishedAttachmentIds ?? new Set<string>();
  const removedTargets: string[] = [];

  const text = splitCodeSegments(body)
    .map((segment) => {
      if (segment.code) {
        return segment.text;
      }

      return segment.text.replace(WIKILINK_PATTERN, (_match, embedMarker, rawTarget, rawDisplay) => {
        const isEmbed = embedMarker === "!";
        const target = (rawTarget as string).trim();
        const display = (rawDisplay as string | undefined)?.trim();
        const label = display ?? target;

        const noteResult = resolveTarget(target, index);
        if (noteResult.status === "resolved") {
          if (publishById.get(noteResult.nodeId)) {
            // The default (no explicit `|alias`) display text is the
            // resolved note's title, not the raw target/id text: the id is
            // for writing/resolving links, the title is for displaying them
            // (ADR-0009).
            const noteLabel = display ?? titleById.get(noteResult.nodeId) ?? label;
            // Note pages live at notes/<id>/index.html (ADR-0018), so a
            // sibling note link goes up one level then into the target's
            // own directory.
            return `[${noteLabel}](../${noteResult.nodeId}/)`;
          }

          removedTargets.push(target);
          return "";
        }

        const attachmentResult = resolveAttachmentTarget(target, attachmentIndex);
        if (attachmentResult.status === "resolved") {
          if (publishedAttachmentIds.has(attachmentResult.attachmentId)) {
            const href = `../../${attachmentResult.attachmentId}`;
            return isEmbed ? `![${label}](${href})` : `[${label}](${href})`;
          }

          removedTargets.push(target);
          return "";
        }

        return `<span class="broken-link">${label}</span>`;
      });
    })
    .join("");

  return { text, removedTargets };
}
