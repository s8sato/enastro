import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface VaultFile {
  /**
   * Note id derived from the file's basename (without the `.md` extension),
   * independent of its directory. NFC-normalized (REQ-CONTENT-008) so that
   * filesystem NFC/NFD differences do not cause resolution failures.
   *
   * Deliberately *not* the relative path: the directory structure of a
   * vault can itself carry non-public information (e.g. private folder
   * taxonomy), so it must never leak into a note's public id/URL
   * (spec/08-security-and-privacy.md privacy invariant, ADR-0004). Since
   * multiple files across different directories can share a basename,
   * `discoverVault` enforces id uniqueness across the whole vault below.
   */
  id: string;
  /** Absolute path to the source file. */
  filePath: string;
  /** Raw file contents. */
  raw: string;
  /**
   * Last-modified time (`fs.Stat.mtime`), as epoch milliseconds. Used to
   * display/search a note's last-modified timestamp (REQ-UX-007). Only
   * `mtime` is captured, not `birthtime` ("created" time): birthtime is
   * unreliable on many Linux filesystems and gets reset on a fresh git
   * clone/checkout, so it would not be a meaningful "created" signal.
   */
  modifiedAt: number;
}

/**
 * Recursively discovers Markdown notes under `vaultDir`. Only `.md` files
 * are treated as notes (matches the v0.1 minimal scope).
 *
 * Fails fast (throws) if two or more notes anywhere in the vault
 * (regardless of `publish` status) would resolve to the same id, since
 * downstream stages key nodes by id (e.g. `Map`s in `src/build/site.ts`)
 * and a silent collision would otherwise cause one note's content to
 * silently overwrite another's.
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

      const basename = path.basename(entry, ".md");
      const id = basename.normalize("NFC");

      files.push({
        id,
        filePath: fullPath,
        raw: readFileSync(fullPath, "utf-8"),
        modifiedAt: stat.mtime.getTime(),
      });
    }
  };

  walk(vaultDir);
  assertUniqueIds(vaultDir, files);
  return files;
}

/**
 * Throws if two or more files share the same id. Collects *all* colliding
 * groups (not just the first pair found) so the author can fix every
 * collision from a single build failure.
 */
function assertUniqueIds(vaultDir: string, files: VaultFile[]): void {
  const byId = new Map<string, VaultFile[]>();
  for (const file of files) {
    const existing = byId.get(file.id) ?? [];
    existing.push(file);
    byId.set(file.id, existing);
  }

  const collisions = [...byId.values()].filter((group) => group.length > 1);
  if (collisions.length === 0) {
    return;
  }

  const details = collisions
    .map((group) => {
      const paths = group.map((file) => path.relative(vaultDir, file.filePath)).join(", ");
      return `  - "${group[0]!.id}": ${paths}`;
    })
    .join("\n");

  throw new Error(
    `enastro: duplicate note id(s) detected (note ids are derived from filename, ` +
      `independent of directory):\n${details}\nRename one of the files in each group ` +
      `so that every note has a unique filename across the whole vault.`,
  );
}
