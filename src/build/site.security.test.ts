import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/security-vault");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("buildSite XSS scan (fixtures/security-vault, REQ-SEC-003)", () => {
  it("never emits a live <script>, event handler, javascript: URI, or <svg> in rendered HTML", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-security-"));
    buildSite(vaultDir, outDir);

    const noteFiles = readdirSync(path.join(outDir, "notes"));
    expect(noteFiles.length).toBeGreaterThan(0);

    for (const file of noteFiles) {
      const content = readFileSync(path.join(outDir, "notes", file), "utf-8");
      expect(content, `${file} must not contain a <script> tag`).not.toMatch(/<script[\s>]/i);
      expect(content, `${file} must not contain an event handler attribute`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(content, `${file} must not contain a javascript: URI`).not.toMatch(/href\s*=\s*"javascript:/i);
      expect(content, `${file} must not contain an <svg> element`).not.toMatch(/<svg[\s>]/i);
      // Sanity check: the note's own descriptive prose (which mentions these
      // keywords as documentation) is still expected to render.
      expect(content).toContain("REQ-SEC-003");
    }
  });
});
