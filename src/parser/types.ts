/**
 * Frontmatter fields recognized by the v0.1 parser.
 *
 * Only `publish` and tag-equivalent fields are required by REQ-CONTENT-004;
 * `aliases` is included because fixtures/basic-vault exercises alias
 * resolution (REQ-CONTENT-006). Unknown frontmatter keys are preserved in
 * `raw` so later stages are not forced to lose information.
 */
export interface Frontmatter {
  publish: boolean;
  tags: string[];
  aliases: string[];
  /**
   * The full parsed frontmatter object, including unrecognized keys. Note:
   * a `title` key here is intentionally NOT surfaced as a typed field — it
   * is invalidated (ADR-0009): the page title is always derived from the
   * note's own first H1 heading (or its id), never from frontmatter. `raw`
   * still carries it so callers can detect and warn about its presence.
   */
  raw: Record<string, unknown>;
}

/** The kind of reference a wikilink-like construct represents. */
export type WikilinkKind = "wikilink" | "embed";

/**
 * A `[[note]]`, `[[note|alias]]`, or `![[note]]` reference extracted from a
 * document body. `target` is the raw, unresolved link text (note title or
 * alias as written); resolving it to an actual note is a Graph IR concern,
 * not a parser concern (REQ-CONTENT-001, REQ-CONTENT-002).
 */
export interface WikilinkRef {
  kind: WikilinkKind;
  target: string;
  /** Display text override from `[[target|display]]`, if present. */
  display?: string;
}

/** The result of parsing a single Markdown document. */
export interface ParsedDocument {
  frontmatter: Frontmatter;
  /** Wikilinks and embeds found in the document body (frontmatter excluded). */
  links: WikilinkRef[];
  /** Inline `#tag` occurrences found in the document body, without the `#`. */
  inlineTags: string[];
  /** The document body with the frontmatter block removed. */
  body: string;
}
