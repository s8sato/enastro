/**
 * Search-term highlighting on note pages (REQ-UX-019, ADR-0019). The index
 * page's search UI (search.mjs) appends the current query to each result
 * link as a URL fragment (`#hl=<query>`); this module reads it back on the
 * note page and wraps every occurrence of each term in the note body with
 * `<mark class="search-hit">`, then scrolls to the first one.
 *
 * The query only ever lives in the fragment, which browsers never send to
 * the server, and is never written to any build artifact or storage.
 * Matching reuses splitQueryTerms() from filter.mjs so the highlighted terms
 * are exactly the terms the search matched on. Only DOM APIs (no innerHTML)
 * touch the page, so a crafted fragment cannot inject markup.
 */
import { splitQueryTerms } from "./filter.mjs";

export const HASH_KEY = "hl";

/**
 * Code blocks and KaTeX output are left untouched: wrapping their text would
 * break syntax-highlighting spans and KaTeX's rendered layout.
 */
const EXCLUDED_SELECTOR = "pre, code, .katex, script, style";

/**
 * @param {string} query
 * @returns {string} `#hl=<encoded query>`, or `""` when the query has no
 *   terms (so result links stay plain when the search box is empty).
 */
export function buildHighlightHash(query) {
  if (splitQueryTerms(query).length === 0) {
    return "";
  }
  return `#${HASH_KEY}=${encodeURIComponent(query.trim())}`;
}

/**
 * @param {string} hash `location.hash`, with or without the leading `#`.
 * @returns {string[]} the lowercased terms to highlight; empty when the
 *   fragment carries no `hl` parameter.
 */
export function parseHighlightHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return splitQueryTerms(params.get(HASH_KEY) ?? "");
}

/**
 * Finds every case-insensitive occurrence of each term in `text`, merging
 * overlapping or adjacent occurrences into a single range. Plain substring
 * search (no RegExp), so terms like `(` or `.*` are matched literally.
 *
 * @param {string} text
 * @param {string[]} terms lowercased terms, as returned by splitQueryTerms().
 * @returns {{start: number, end: number}[]} ranges into `text`, sorted and
 *   non-overlapping.
 */
export function findMatchRanges(text, terms) {
  // Lowercase per character while keeping a map back to `text` offsets,
  // since toLowerCase() can change the length of some characters (e.g. "İ").
  let lower = "";
  const offsets = [];
  let index = 0;
  for (const char of text) {
    const lowered = char.toLowerCase();
    for (let i = 0; i < lowered.length; i++) {
      offsets.push(index);
    }
    lower += lowered;
    index += char.length;
  }
  offsets.push(text.length);

  const ranges = [];
  for (const term of terms) {
    if (!term) {
      continue;
    }
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + 1)) {
      ranges.push({ start: offsets[at], end: offsets[at + term.length] });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * @param {Element} root
 * @param {string[]} terms
 * @returns {HTMLElement[]} the inserted `<mark>` elements, in document order.
 */
function highlightTerms(root, terms) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(EXCLUDED_SELECTOR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  // Collect first: splitting text nodes while walking would confuse the walker.
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const marks = [];
  for (const textNode of textNodes) {
    const ranges = findMatchRanges(textNode.data, terms);
    const nodeMarks = [];
    // Right to left, so `textNode` keeps holding the not-yet-processed prefix.
    for (const { start, end } of ranges.reverse()) {
      textNode.splitText(end);
      const hit = textNode.splitText(start);
      const mark = document.createElement("mark");
      mark.className = "search-hit";
      hit.replaceWith(mark);
      mark.append(hit);
      nodeMarks.unshift(mark);
    }
    marks.push(...nodeMarks);
  }
  return marks;
}

function main() {
  const article = document.querySelector("article");
  const terms = parseHighlightHash(location.hash);
  if (!article || terms.length === 0) {
    return;
  }
  const marks = highlightTerms(article, terms);
  marks[0]?.scrollIntoView({ block: "center" });
}

// Guarded so this module can be imported for its pure functions from a
// plain Node test environment (no `document` global), and from search.mjs
// on the index page (no `<article>`, so main() is a no-op there).
if (typeof document !== "undefined") {
  main();
}
