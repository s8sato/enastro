import { execFileSync } from "node:child_process";

/**
 * The record separator between a commit's date field and its list of
 * changed file paths in the `git log` output parsed below. ASCII "record
 * separator" (0x1E) cannot appear in a valid ISO 8601 date or a normal file
 * path, so it is a safe, unambiguous delimiter. NUL (`\0`) is deliberately
 * *not* used here: argv strings are NUL-terminated C strings under the
 * hood, so embedding `\0` inside a single `--format=...` argument silently
 * truncates it before reaching `git` at all.
 */
const RECORD_SEPARATOR = "\x1e";

/**
 * Builds a map from vault-relative file path to the epoch-ms date of the
 * most recent git commit that touched that path, for use as
 * `VaultFile.modifiedAt` (ADR-0015) in place of filesystem `mtime`, which
 * gets reset to "now" on every fresh `git clone`/`checkout` (e.g. in CI
 * publish pipelines) and is therefore not a meaningful "last edited by the
 * author" signal.
 *
 * Runs a single `git log` invocation for the whole vault (not one per
 * file), so this scales to large vaults without spawning one process per
 * note. Returns `null` (rather than throwing) if `vaultDir` is not inside a
 * git repository, `git` is not installed, or any other failure occurs —
 * callers should fall back to `fs.Stat.mtime` per file in that case, per
 * ADR-0015's decision to never let this be a hard build failure.
 *
 * Deliberately does *not* consider uncommitted working-tree changes: only
 * committed history is reflected (ADR-0015, "未コミットの変更は無視してよい").
 * A file with no commits touching it yet (e.g. just added, uncommitted)
 * simply has no entry in the returned map, so callers fall back to that
 * file's own mtime.
 *
 * @param vaultDir absolute path to the vault directory (or any directory
 *   inside a git working tree).
 * @returns map of vault-relative path (forward-slash separated, matching
 *   `discoverVault`'s relative-path convention) to epoch ms, or `null` if
 *   git history could not be read.
 */
export function getGitModifiedAtMap(vaultDir: string): Map<string, number> | null {
  let stdout: string;
  try {
    stdout = execFileSync(
      "git",
      // `-c core.quotePath=false`: git's default `core.quotePath=true` would
      // otherwise C-quote/octal-escape any non-ASCII byte in a path (e.g.
      // Japanese note filenames), turning `--name-only` output into escaped
      // ASCII strings that no longer match the raw UTF-8 relative paths
      // computed by discoverVault() — silently losing `modifiedAt` for every
      // such file (all lookups miss, falling back to the "unknown" sentinel).
      //
      // The trailing `-- .` pathspec scopes both commit selection and the
      // `--name-only` file list to paths under `vaultDir` (combined with
      // `--relative`, cwd-relative). Without it, a vault nested inside a
      // larger repo (e.g. this repo's own fixtures/) would walk the whole
      // repository's history and list unrelated files outside the vault.
      [
        "-c",
        "core.quotePath=false",
        "log",
        "--relative",
        "--name-only",
        `--format=${RECORD_SEPARATOR}%cI`,
        "--",
        ".",
      ],
      { cwd: vaultDir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }

  const modifiedAtByPath = new Map<string, number>();
  // `git log`'s custom `--format` is only applied to the commit header
  // line; the `--name-only` file list for that commit follows as
  // subsequent plain lines, terminated by a blank line before the next
  // commit's header. Splitting the whole output on the record separator
  // yields one chunk per commit: the first line of each chunk is the ISO
  // date, and the remaining non-empty lines are the changed paths.
  const chunks = stdout.split(RECORD_SEPARATOR).slice(1); // drop leading empty chunk before the first separator
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const dateLine = lines[0];
    if (dateLine === undefined) continue;
    const epochMs = Date.parse(dateLine);
    if (Number.isNaN(epochMs)) continue;

    for (const line of lines.slice(1)) {
      const relPath = line.trim();
      if (relPath === "") continue;
      // `git log` is newest-first, so the first commit seen for a given
      // path is its most recent one; later (older) occurrences are
      // ignored.
      if (!modifiedAtByPath.has(relPath)) {
        modifiedAtByPath.set(relPath, epochMs);
      }
    }
  }

  return modifiedAtByPath;
}
