import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { VAULT_CONFIG_FILENAME } from "./config.js";

export interface AttachmentFile {
  /**
   * Vault-relative path (POSIX separators, NFC-normalized), e.g.
   * `attachments/public.png`. Unlike note ids, the extension is kept, since
   * attachments have no canonical extension-less identity.
   */
  id: string;
  /** Absolute path to the source file. */
  filePath: string;
}

/**
 * Recursively discovers non-Markdown files under `vaultDir` (candidate
 * attachments). `.md` notes and the vault config file itself are excluded.
 */
export function discoverAttachments(vaultDir: string): AttachmentFile[] {
  const files: AttachmentFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.toLowerCase().endsWith(".md") || entry === VAULT_CONFIG_FILENAME) {
        continue;
      }

      const relative = path.relative(vaultDir, fullPath);
      const id = relative.split(path.sep).join("/").normalize("NFC");

      files.push({ id, filePath: fullPath });
    }
  };

  walk(vaultDir);
  return files;
}
