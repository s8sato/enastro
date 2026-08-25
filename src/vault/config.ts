import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const VAULT_CONFIG_FILENAME = "enastro.config.json";

/** Must be kept in sync with `THEMES`' `id`s in
 * `src/render/client/theme-switcher.mjs` (REQ-UX-011). Duplicated here
 * (rather than imported) to keep this build/server-side module independent
 * of the browser-only client asset modules. */
const VALID_THEMES = [
  "aurora",
  "corona",
  "ether",
  "flare",
  "graviton",
  "moon",
  "nebula",
  "nova",
  "pulser",
  "sirius",
  "venus",
  "void",
];

/** Must be kept in sync with `VALID_DIRECTIONS` in
 * `src/render/client/particle-direction.mjs` (REQ-UX-012). */
const VALID_PARTICLE_DIRECTIONS = ["wikilink", "backlink"];

const DEFAULT_SITE_TITLE = "Notes";
const DEFAULT_THEME = "moon";
const DEFAULT_PARTICLE_DIRECTION = "wikilink";

export interface VaultConfig {
  /**
   * Vault-relative paths (exact match, no globs — DEFERRED to a later loop)
   * of attachments that are allowed to be published (REQ-PUB-006,
   * REQ-SEC-002, ADR-0003). Absence of a config file, or of this field,
   * means no attachments are published (private by default).
   */
  publishAttachments: string[];
  /** Site title, shown in the All Notes page's `<h1>`/`<title>`
   * (REQ-UX-013, ADR-0016). Defaults to `"Notes"` if unspecified. */
  siteTitle: string;
  /** Build-time default color theme (REQ-UX-011, ADR-0016), applied only
   * when the viewer has no theme already stored in `localStorage`; the
   * viewer's own choice always takes precedence and is never overridden.
   * Defaults to `"moon"` if unspecified. */
  defaultTheme: string;
  /** Build-time default particle travel direction on `graph.html`
   * (REQ-UX-012, ADR-0016), applied only when the viewer has no direction
   * already stored in `localStorage`. Defaults to `"wikilink"` if
   * unspecified. */
  defaultParticleDirection: "wikilink" | "backlink";
}

/**
 * Loads `enastro.config.json` from the vault root. If the file does not
 * exist, returns a config with an empty allowlist — attachments are private
 * by default (REQ-SEC-002) — and the built-in defaults for the other
 * fields.
 */
export function loadVaultConfig(vaultDir: string): VaultConfig {
  const configPath = path.join(vaultDir, VAULT_CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {
      publishAttachments: [],
      siteTitle: DEFAULT_SITE_TITLE,
      defaultTheme: DEFAULT_THEME,
      defaultParticleDirection: DEFAULT_PARTICLE_DIRECTION,
    };
  }

  const raw = readFileSync(configPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${VAULT_CONFIG_FILENAME} is not valid JSON: ${(error as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${VAULT_CONFIG_FILENAME} must contain a JSON object`);
  }

  const obj = parsed as Record<string, unknown>;
  const publishAttachments = obj.publishAttachments ?? [];

  if (!Array.isArray(publishAttachments) || !publishAttachments.every((value) => typeof value === "string")) {
    throw new Error(`${VAULT_CONFIG_FILENAME}: "publishAttachments" must be an array of strings`);
  }

  const siteTitle = obj.siteTitle ?? DEFAULT_SITE_TITLE;
  if (typeof siteTitle !== "string" || siteTitle.length === 0) {
    throw new Error(`${VAULT_CONFIG_FILENAME}: "siteTitle" must be a non-empty string`);
  }

  const defaultTheme = obj.defaultTheme ?? DEFAULT_THEME;
  if (typeof defaultTheme !== "string" || !VALID_THEMES.includes(defaultTheme)) {
    throw new Error(
      `${VAULT_CONFIG_FILENAME}: "defaultTheme" must be one of ${VALID_THEMES.map((t) => `"${t}"`).join(", ")}`,
    );
  }

  const defaultParticleDirection = obj.defaultParticleDirection ?? DEFAULT_PARTICLE_DIRECTION;
  if (
    typeof defaultParticleDirection !== "string" ||
    !VALID_PARTICLE_DIRECTIONS.includes(defaultParticleDirection)
  ) {
    throw new Error(`${VAULT_CONFIG_FILENAME}: "defaultParticleDirection" must be "wikilink" or "backlink"`);
  }

  return {
    publishAttachments: publishAttachments.map((value) => value.normalize("NFC")),
    siteTitle: siteTitle.normalize("NFC"),
    defaultTheme,
    defaultParticleDirection: defaultParticleDirection as "wikilink" | "backlink",
  };
}
