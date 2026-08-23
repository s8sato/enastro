import path from "node:path";
import type { AttachmentFile } from "./discover-attachments.js";

/** basename (NFC-normalized) -> matching attachment ids (may collide). */
export interface AttachmentResolutionIndex {
  basenameIndex: Map<string, string[]>;
}

export type AttachmentResolutionResult =
  | { status: "resolved"; attachmentId: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "unresolved" };

/**
 * Builds a basename lookup index for attachments, mirroring how Obsidian
 * resolves `![[file.png]]` embeds by filename rather than full path.
 */
export function buildAttachmentResolutionIndex(attachments: AttachmentFile[]): AttachmentResolutionIndex {
  const basenameIndex = new Map<string, string[]>();

  for (const attachment of attachments) {
    const key = path.basename(attachment.id).normalize("NFC");
    const existing = basenameIndex.get(key) ?? [];
    existing.push(attachment.id);
    basenameIndex.set(key, existing);
  }

  return { basenameIndex };
}

/**
 * Resolves a wikilink/embed target to an attachment id by basename. Multiple
 * attachments sharing a basename are left ambiguous rather than guessed
 * (consistent with note alias resolution, REQ-CONTENT-006's spirit).
 */
export function resolveAttachmentTarget(
  target: string,
  index: AttachmentResolutionIndex,
): AttachmentResolutionResult {
  const key = target.normalize("NFC");
  const matches = index.basenameIndex.get(key);

  if (matches && matches.length === 1) {
    return { status: "resolved", attachmentId: matches[0]! };
  }
  if (matches && matches.length > 1) {
    return { status: "ambiguous", candidates: matches };
  }

  return { status: "unresolved" };
}
