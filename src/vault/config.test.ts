import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadVaultConfig } from "./config.js";

let vaultDir: string;

afterEach(() => {
  if (vaultDir) {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

describe("loadVaultConfig", () => {
  it("returns an empty allowlist when no config file exists (private by default)", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));

    expect(loadVaultConfig(vaultDir)).toEqual({ publishAttachments: [] });
  });

  it("parses a valid publishAttachments array", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(
      path.join(vaultDir, "enastro.config.json"),
      JSON.stringify({ publishAttachments: ["attachments/public.png"] }),
    );

    expect(loadVaultConfig(vaultDir)).toEqual({ publishAttachments: ["attachments/public.png"] });
  });

  it("treats a missing publishAttachments field as an empty allowlist", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(path.join(vaultDir, "enastro.config.json"), JSON.stringify({}));

    expect(loadVaultConfig(vaultDir)).toEqual({ publishAttachments: [] });
  });

  it("throws on invalid JSON", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(path.join(vaultDir, "enastro.config.json"), "{not json");

    expect(() => loadVaultConfig(vaultDir)).toThrow();
  });

  it("throws when publishAttachments is not an array of strings", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(
      path.join(vaultDir, "enastro.config.json"),
      JSON.stringify({ publishAttachments: [123] }),
    );

    expect(() => loadVaultConfig(vaultDir)).toThrow();
  });
});
