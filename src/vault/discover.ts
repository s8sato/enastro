import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface VaultFile {
  /**
   * Note id derived from the file path relative to the vault root, without
   * the `.md` extension. NFC-normalized (REQ-CONTENT-008) so that filesystem
   * NFC/NFD differences do not cause resolution failures.
   */
  id: string;
  /** Absolute path to the source file. */
  filePath: string;
  /** Raw file contents. */
  raw: string;
}

/**
 * Recursively discovers Markdown notes under `vaultDir`. Only `.md` files
 * are treated as notes (matches the v0.1 minimal scope).
 */
export function discoverVault(vaultDir: string): VaultFile[] {
  const files: VaultFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.toLowerCase().endsWith(".md")) {
        continue;
      }

      const relative = path.relative(vaultDir, fullPath);
      const withoutExt = relative.slice(0, -".md".length);
      const id = withoutExt.split(path.sep).join("/").normalize("NFC");

      files.push({ id, filePath: fullPath, raw: readFileSync(fullPath, "utf-8") });
    }
  };

  walk(vaultDir);
  return files;
}
