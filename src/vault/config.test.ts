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
  it("returns an empty allowlist and built-in defaults when no config file exists (private by default)", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));

    expect(loadVaultConfig(vaultDir)).toEqual({
      publishAttachments: [],
      siteTitle: "Notes",
      defaultTheme: "moon",
      defaultParticleDirection: "wikilink",
    });
  });

  it("parses a valid publishAttachments array", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(
      path.join(vaultDir, "enastro.config.json"),
      JSON.stringify({ publishAttachments: ["attachments/public.png"] }),
    );

    expect(loadVaultConfig(vaultDir)).toEqual({
      publishAttachments: ["attachments/public.png"],
      siteTitle: "Notes",
      defaultTheme: "moon",
      defaultParticleDirection: "wikilink",
    });
  });

  it("treats a missing publishAttachments field as an empty allowlist", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(path.join(vaultDir, "enastro.config.json"), JSON.stringify({}));

    expect(loadVaultConfig(vaultDir)).toEqual({
      publishAttachments: [],
      siteTitle: "Notes",
      defaultTheme: "moon",
      defaultParticleDirection: "wikilink",
    });
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

  it("parses valid siteTitle/defaultTheme/defaultParticleDirection overrides", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(
      path.join(vaultDir, "enastro.config.json"),
      JSON.stringify({ siteTitle: "My Garden", defaultTheme: "nova", defaultParticleDirection: "backlink" }),
    );

    expect(loadVaultConfig(vaultDir)).toEqual({
      publishAttachments: [],
      siteTitle: "My Garden",
      defaultTheme: "nova",
      defaultParticleDirection: "backlink",
    });
  });

  it("throws when siteTitle is an empty string", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(path.join(vaultDir, "enastro.config.json"), JSON.stringify({ siteTitle: "" }));

    expect(() => loadVaultConfig(vaultDir)).toThrow();
  });

  it("throws when defaultTheme is not one of the 12 known theme ids", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(path.join(vaultDir, "enastro.config.json"), JSON.stringify({ defaultTheme: "not-a-theme" }));

    expect(() => loadVaultConfig(vaultDir)).toThrow();
  });

  it("throws when defaultParticleDirection is not 'wikilink' or 'backlink'", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-config-"));
    writeFileSync(
      path.join(vaultDir, "enastro.config.json"),
      JSON.stringify({ defaultParticleDirection: "sideways" }),
    );

    expect(() => loadVaultConfig(vaultDir)).toThrow();
  });
});
