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
      { id: "note-a", filePath: expect.any(String), raw: "# Note A", modifiedAt: expect.any(Number) },
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
});
