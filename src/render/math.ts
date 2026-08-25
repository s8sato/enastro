import katex from "katex";
import MarkdownIt from "markdown-it";
import type { Env, MarkdownItOptions, StateBlock, StateInline, Token } from "markdown-it";

/**
 * Math (KaTeX) rendering — REQ-CONTENT-010, ADR-0017.
 *
 * Renders `$...$` (inline) and `$$...$$` (block) math to HTML at BUILD TIME
 * (server-side, via `katex.renderToString`), the same philosophy as
 * highlight.js's server-side syntax highlighting elsewhere in this file's
 * sibling `render-note.ts`.
 *
 * Deliberately NOT wired through `sanitizeHtml`'s allowlist (src/sanitize/
 * config.ts): KaTeX's HTML output relies on dozens of internal CSS classes
 * and per-element inline `style` attributes for correct glyph positioning,
 * none of which are part of KaTeX's public/stable API surface. Hardcoding
 * that vocabulary into the sanitizer's allowlist would be a brittle,
 * version-fragile maintenance burden (ADR-0017). Instead, each rendered
 * math fragment is stashed in `env.__mathFragments` and replaced by a
 * placeholder token in the token stream; `render-note.ts` substitutes the
 * placeholders back in AFTER the normal `sanitizeHtml()` pass, so the
 * trusted KaTeX-generated HTML never has to pass through the allowlist.
 * KaTeX's own `trust: false` (default, kept explicit below) is the security
 * boundary for this content type instead: it disables any LaTeX command
 * that could otherwise inject arbitrary HTML/CSS or unsafe URLs (`\href`,
 * `\includegraphics`, `\htmlId`, `\htmlClass`, `\htmlStyle`, `\htmlData`).
 */

const PLACEHOLDER_PREFIX = "\u0000MATH:";
const PLACEHOLDER_SUFFIX = "\u0000";

/** Mutable bag threaded through a single `markdown.render(text, env)` call. */
export interface MathRenderEnv extends Env {
  __mathFragments?: string[];
}

function stashFragment(env: MathRenderEnv, html: string): string {
  const fragments = (env.__mathFragments ??= []);
  const index = fragments.length;
  fragments.push(html);
  return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
}

function renderTex(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    output: "html",
    throwOnError: false,
    trust: false,
    strict: "ignore",
  });
}

/**
 * Block rule for a paragraph consisting of `$$ ... $$` (possibly spanning
 * multiple lines), mirroring the structure of markdown-it's built-in
 * `fence` rule (registered just before it) but without an info string.
 */
function mathBlockRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  // `state.bMarks`/`state.tShift`/`state.eMarks` are always defined for any
  // line index in `[startLine, endLine)` by markdown-it's own block-parser
  // contract; non-null assertions mirror this file's guaranteed invariant.
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;

  if (start + 2 > max || state.src.slice(start, start + 2) !== "$$") {
    return false;
  }

  const firstLineTail = state.src.slice(start + 2, max);
  const lines: string[] = [];
  let nextLine = startLine;
  let found = false;

  const trimmedTail = firstLineTail.trim();
  if (trimmedTail.endsWith("$$")) {
    // Single-line `$$...$$`.
    lines.push(trimmedTail.slice(0, -2).trim());
    found = true;
  } else {
    if (trimmedTail.length > 0) lines.push(trimmedTail);
    while (++nextLine < endLine) {
      const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
      const lineMax = state.eMarks[nextLine]!;
      const line = state.src.slice(lineStart, lineMax);
      if (line.trim() === "$$") {
        found = true;
        break;
      }
      lines.push(line);
    }
  }

  if (!found) return false;
  if (silent) return true;

  state.line = nextLine + 1;
  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = lines.join("\n").trim();
  token.map = [startLine, state.line];
  return true;
}

/**
 * Inline rule for `$...$`. Requires the character right after the opening
 * `$` and right before the closing `$` to be non-whitespace (a common
 * heuristic, also used by other markdown math plugins, to avoid false
 * positives like "It costs $5 and $10 more"). Skips escaped `\$`. Only
 * matches within a single line (no math spanning a hard line break).
 * `$$` (immediately doubled) is left untouched here so it doesn't shadow
 * `mathBlockRule` above.
 */
function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;

  if (src.charCodeAt(start) !== 0x24 /* $ */) return false;
  if (src.charCodeAt(start + 1) === 0x24 /* $$ */) return false;
  if (start > 0 && src.charCodeAt(start - 1) === 0x5c /* \ */) return false;

  const contentStart = start + 1;
  if (contentStart >= state.posMax) return false;
  if (/\s/.test(src.charAt(contentStart))) return false;

  let end = -1;
  for (let pos = contentStart + 1; pos < state.posMax; pos += 1) {
    const code = src.charCodeAt(pos);
    if (code === 0x0a /* \n */) return false;
    if (code === 0x24 && src.charCodeAt(pos - 1) !== 0x5c) {
      end = pos;
      break;
    }
  }
  if (end === -1) return false;
  if (/\s/.test(src.charAt(end - 1))) return false;

  if (!silent) {
    const tex = src.slice(contentStart, end).replace(/\\\$/g, "$");
    const token = state.push("math_inline", "math", 0);
    token.content = tex;
  }

  state.pos = end + 1;
  return true;
}

/** Installs the `$`/`$$` math rules and their KaTeX-backed renderers. */
export function installMathRenderer(md: InstanceType<typeof MarkdownIt>): void {
  md.block.ruler.before("fence", "math_block", mathBlockRule);
  md.inline.ruler.before("escape", "math_inline", mathInlineRule);

  md.renderer.rules.math_block = (
    tokens: Token[],
    idx: number,
    _options: MarkdownItOptions,
    env: MathRenderEnv | undefined,
  ) => stashFragment(env ?? {}, renderTex(tokens[idx]!.content, true));
  md.renderer.rules.math_inline = (
    tokens: Token[],
    idx: number,
    _options: MarkdownItOptions,
    env: MathRenderEnv | undefined,
  ) => stashFragment(env ?? {}, renderTex(tokens[idx]!.content, false));
}

/** Substitutes `env.__mathFragments` placeholders back into sanitized HTML. */
export function substituteMathFragments(html: string, env: MathRenderEnv): string {
  const fragments = env.__mathFragments;
  if (!fragments || fragments.length === 0) return html;
  return html.replace(
    new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, "g"),
    (_match, indexStr: string) => fragments[Number(indexStr)] ?? "",
  );
}
