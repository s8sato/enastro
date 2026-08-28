import type MarkdownIt from "markdown-it";
import type { RendererRule } from "markdown-it";

/**
 * Opens external links in a new tab (REQ-UX-014). Only absolute `http(s)://`
 * URLs are affected — wikilink-resolved notes, `#tag` links, and attachments
 * all use relative paths and are left untouched, as does `mailto:`.
 *
 * `rel="noopener noreferrer"` accompanies `target="_blank"` to prevent the
 * opened page from accessing `window.opener` (reverse tabnabbing).
 */
const EXTERNAL_HREF_PATTERN = /^https?:\/\//i;

/** Installs the `<a>` renderer override that adds `target`/`rel` to external links. */
export function installExternalLinkRenderer(md: InstanceType<typeof MarkdownIt>): void {
  const defaultRender: RendererRule =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx]!.attrGet("href");
    if (typeof href === "string" && EXTERNAL_HREF_PATTERN.test(href)) {
      tokens[idx]!.attrSet("target", "_blank");
      tokens[idx]!.attrSet("rel", "noopener noreferrer");
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}
