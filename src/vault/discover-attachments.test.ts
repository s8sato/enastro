import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverAttachments } from "./discover-attachments.js";

let vaultDir: string;

afterEach(() => {
  if (vaultDir) {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

describe("discoverAttachments", () => {
  it("discovers non-.md files recursively, excluding notes and the config file", () => {
    vaultDir = mkdtempSync(path.join(tmpdir(), "enastro-attachments-"));
    mkdirSync(path.join(vaultDir, "attachments"), { recursive: true });
    writeFileSync(path.join(vaultDir, "note.md"), "# Note");
    writeFileSync(path.join(vaultDir, "enastro.config.json"), "{}");
    writeFileSync(path.join(vaultDir, "attachments", "public.png"), "fake-png-bytes");

    const attachments = discoverAttachments(vaultDir);

    expect(attachments).toEqual([{ id: "attachments/public.png", filePath: expect.any(String) }]);
  });
});
