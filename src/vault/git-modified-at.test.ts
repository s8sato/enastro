import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getGitModifiedAtMap } from "./git-modified-at.js";

let vaultDir: string;

afterEach(() => {
  if (vaultDir) {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

/** Commits the given already-written file with a fixed, deterministic date. */
function commitFile(repoDir: string, relPath: string, isoDate: string): void {
  const env = { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate };
  execFileSync("git", ["add", relPath], { cwd: repoDir });
  execFileSync("git", ["commit", "-m", `commit ${relPath}`], { cwd: repoDir, env });
}

function initRepo(repoDir: string): void {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: repoDir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: repoDir });
}

describe("getGitModifiedAtMap", () => {
  it("returns null when the directory is not inside a git repository", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    writeFileSync(path.join(vaultDir, "note-a.md"), "a");

    expect(getGitModifiedAtMap(vaultDir)).toBeNull();
  });

  it("maps each committed file to the date of the commit that most recently touched it", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    initRepo(vaultDir);
    writeFileSync(path.join(vaultDir, "note-a.md"), "a");
    commitFile(vaultDir, "note-a.md", "2020-01-01T00:00:00Z");
    writeFileSync(path.join(vaultDir, "note-b.md"), "b");
    commitFile(vaultDir, "note-b.md", "2021-06-01T00:00:00Z");

    const map = getGitModifiedAtMap(vaultDir);

    expect(map?.get("note-a.md")).toBe(Date.parse("2020-01-01T00:00:00Z"));
    expect(map?.get("note-b.md")).toBe(Date.parse("2021-06-01T00:00:00Z"));
  });

  it("uses the most recent commit's date when a file is touched by multiple commits", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    initRepo(vaultDir);
    writeFileSync(path.join(vaultDir, "note-a.md"), "v1");
    commitFile(vaultDir, "note-a.md", "2020-01-01T00:00:00Z");
    writeFileSync(path.join(vaultDir, "note-a.md"), "v2");
    commitFile(vaultDir, "note-a.md", "2022-03-01T00:00:00Z");

    const map = getGitModifiedAtMap(vaultDir);

    expect(map?.get("note-a.md")).toBe(Date.parse("2022-03-01T00:00:00Z"));
  });

  it("has no entry for an uncommitted file, so callers fall back to its own mtime (ADR-0015)", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    initRepo(vaultDir);
    writeFileSync(path.join(vaultDir, "note-a.md"), "a");
    commitFile(vaultDir, "note-a.md", "2020-01-01T00:00:00Z");
    // note-b.md is written but never committed.
    writeFileSync(path.join(vaultDir, "note-b.md"), "b");

    const map = getGitModifiedAtMap(vaultDir);

    expect(map?.has("note-b.md")).toBe(false);
  });

  it("ignores uncommitted working-tree edits to an already-committed file (ADR-0015)", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    initRepo(vaultDir);
    writeFileSync(path.join(vaultDir, "note-a.md"), "v1");
    commitFile(vaultDir, "note-a.md", "2020-01-01T00:00:00Z");
    // Edited on disk but never committed.
    writeFileSync(path.join(vaultDir, "note-a.md"), "v2 (uncommitted)");

    const map = getGitModifiedAtMap(vaultDir);

    expect(map?.get("note-a.md")).toBe(Date.parse("2020-01-01T00:00:00Z"));
  });

  it("maps non-ASCII (e.g. Japanese) filenames correctly, unaffected by git's default path-quoting", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    initRepo(vaultDir);
    writeFileSync(path.join(vaultDir, "圏.md"), "category");
    commitFile(vaultDir, "圏.md", "2020-01-01T00:00:00Z");

    const map = getGitModifiedAtMap(vaultDir);

    expect(map?.get("圏.md")).toBe(Date.parse("2020-01-01T00:00:00Z"));
  });

  it("scopes results to files under vaultDir when the vault is a subdirectory of a larger repo", () => {
    const repoDir = mkdtempSync(path.join(tmpdir(), "enastro-git-modified-at-"));
    vaultDir = repoDir; // cleaned up together
    initRepo(repoDir);
    writeFileSync(path.join(repoDir, "outside.md"), "outside");
    commitFile(repoDir, "outside.md", "2019-01-01T00:00:00Z");
    const vaultSubDir = path.join(repoDir, "vault");
    mkdirSync(vaultSubDir);
    writeFileSync(path.join(vaultSubDir, "note-a.md"), "a");
    commitFile(repoDir, "vault/note-a.md", "2020-01-01T00:00:00Z");

    const map = getGitModifiedAtMap(vaultSubDir);

    expect(map?.get("note-a.md")).toBe(Date.parse("2020-01-01T00:00:00Z"));
    expect(map?.has("outside.md")).toBe(false);
    expect(map?.has("../outside.md")).toBe(false);
  });
});
