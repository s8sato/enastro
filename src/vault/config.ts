import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const VAULT_CONFIG_FILENAME = "enastro.config.json";

export interface VaultConfig {
  /**
   * Vault-relative paths (exact match, no globs — DEFERRED to a later loop)
   * of attachments that are allowed to be published (REQ-PUB-006,
   * REQ-SEC-002, ADR-0003). Absence of a config file, or of this field,
   * means no attachments are published (private by default).
   */
  publishAttachments: string[];
}

/**
 * Loads `enastro.config.json` from the vault root. If the file does not
 * exist, returns a config with an empty allowlist — attachments are private
 * by default (REQ-SEC-002).
 */
export function loadVaultConfig(vaultDir: string): VaultConfig {
  const configPath = path.join(vaultDir, VAULT_CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return { publishAttachments: [] };
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

  return { publishAttachments: publishAttachments.map((value) => value.normalize("NFC")) };
}
