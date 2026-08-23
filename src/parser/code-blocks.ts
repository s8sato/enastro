const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const COMBINED_CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;

/**
 * Removes fenced and inline code spans so that link/tag extractors do not
 * misinterpret code samples as wikilinks or tags. This is a lightweight
 * heuristic, not a full Markdown parser (REQ-CONTENT-005 scope only requires
 * that unsupported syntax pass through without error, not full fidelity).
 */
export function stripCode(text: string): string {
  return text.replace(CODE_FENCE_PATTERN, "").replace(INLINE_CODE_PATTERN, "");
}

export interface TextSegment {
  /** True if this segment is a fenced or inline code span. */
  code: boolean;
  text: string;
}

/**
 * Splits `text` into alternating code/non-code segments so that a caller can
 * transform non-code segments (e.g. substituting wikilinks) while leaving
 * code spans untouched.
 */
export function splitCodeSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(COMBINED_CODE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ code: false, text: text.slice(lastIndex, start) });
    }
    segments.push({ code: true, text: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ code: false, text: text.slice(lastIndex) });
  }

  return segments;
}
