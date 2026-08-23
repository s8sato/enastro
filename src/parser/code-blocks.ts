const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;

/**
 * Removes fenced and inline code spans so that link/tag extractors do not
 * misinterpret code samples as wikilinks or tags. This is a lightweight
 * heuristic, not a full Markdown parser (REQ-CONTENT-005 scope only requires
 * that unsupported syntax pass through without error, not full fidelity).
 */
export function stripCode(text: string): string {
  return text.replace(CODE_FENCE_PATTERN, "").replace(INLINE_CODE_PATTERN, "");
}
