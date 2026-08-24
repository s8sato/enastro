import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverVault } from "./discover.js";

let vaultDir: string;

afterEach(() => {
  if (vaultDir) {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

describe("discoverVault", () => {
  it("derives note id from the file's basename, independent of its directory", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-discover-"));
    mkdirSync(path.join(vaultDir, "sub"), { recursive: true });
    writeFileSync(path.join(vaultDir, "sub", "note-a.md"), "# Note A");

    const files = discoverVault(vaultDir);

    expect(files).toEqual([
      { id: "note-a", filePath: expect.any(String), raw: "# Note A", modifiedAt: 0 },
    ]);
  });

  it("throws a single error listing every colliding id group when two or more files share a basename", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-discover-"));
    mkdirSync(path.join(vaultDir, "public"), { recursive: true });
    mkdirSync(path.join(vaultDir, "private"), { recursive: true });
    writeFileSync(path.join(vaultDir, "public", "note-a.md"), "public");
    writeFileSync(path.join(vaultDir, "private", "note-a.md"), "private");
    writeFileSync(path.join(vaultDir, "public", "note-b.md"), "b1");
    writeFileSync(path.join(vaultDir, "private", "note-b.md"), "b2");

    expect(() => discoverVault(vaultDir)).toThrowError(/note-a[\s\S]*note-b|note-b[\s\S]*note-a/);
  });

  it("does not throw when all ids are unique", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-discover-"));
    writeFileSync(path.join(vaultDir, "note-a.md"), "a");
    writeFileSync(path.join(vaultDir, "note-b.md"), "b");

    expect(() => discoverVault(vaultDir)).not.toThrow();
  });

  // ADR-0015: modifiedAt is sourced *only* from git commit history; `0`
  // (the UNIX epoch, used as an "unknown" sentinel) is the outcome when
  // it isn't available (see git-modified-at.test.ts for the underlying
  // helper's own coverage). The 3 tests above (plain, non-git temp dirs)
  // already cover that fallback path; this covers the git-based primary
  // path end-to-end through discoverVault itself.
  it("sources modifiedAt from git commit history when the vault is a git repository", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-discover-"));
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: vaultDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: vaultDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: vaultDir });
    writeFileSync(path.join(vaultDir, "note-a.md"), "a");
    const isoDate = "2020-01-01T00:00:00Z";
    execFileSync("git", ["add", "note-a.md"], { cwd: vaultDir });
    execFileSync("git", ["commit", "-m", "add note-a"], {
      cwd: vaultDir,
      env: { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
    });

    const files = discoverVault(vaultDir);

    expect(files).toEqual([
      { id: "note-a", filePath: expect.any(String), raw: "a", modifiedAt: Date.parse(isoDate) },
    ]);
  });
});
