import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/basic-vault");

const outDirs: string[] = [];

afterEach(() => {
  for (const dir of outDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function hashDir(dir: string): string {
  const hash = createHash("sha256");
  for (const file of listFiles(dir).sort()) {
    hash.update(path.relative(dir, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

describe("buildSite determinism (REQ-BUILD-001)", () => {
  it("produces byte-identical output across two independent builds of the same vault", () => {
    const outDirA = mkdtempSync(path.join(tmpdir(), "enastro-golden-a-"));
    const outDirB = mkdtempSync(path.join(tmpdir(), "enastro-golden-b-"));
    outDirs.push(outDirA, outDirB);

    buildSite(vaultDir, outDirA);
    buildSite(vaultDir, outDirB);

    expect(hashDir(outDirA)).toBe(hashDir(outDirB));
  });
});
