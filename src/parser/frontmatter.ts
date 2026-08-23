import { parse as parseYaml } from "yaml";
import type { Frontmatter } from "./types.js";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface FrontmatterParseResult {
  frontmatter: Frontmatter;
  /** The document body with the frontmatter block removed. */
  body: string;
}

/**
 * Parses the YAML frontmatter block at the start of a document, if present
 * (REQ-CONTENT-004). Documents without a frontmatter block are treated as
 * `publish: false` (private by default), consistent with the privacy
 * invariant (REQ-SEC-001): absence of an explicit opt-in must never result
 * in accidental publication.
 */
export function parseFrontmatter(raw: string): FrontmatterParseResult {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      frontmatter: { publish: false, tags: [], aliases: [], raw: {} },
      body: raw,
    };
  }

  const yamlBlock = match[1] ?? "";
  const body = raw.slice(match[0].length);
  const parsed = (parseYaml(yamlBlock) ?? {}) as Record<string, unknown>;

  return {
    frontmatter: {
      publish: parsed.publish === true,
      tags: toStringArray(parsed.tags),
      aliases: toStringArray(parsed.aliases),
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      raw: parsed,
    },
    body,
  };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}
