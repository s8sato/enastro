import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite } from "./site.js";

const vaultDir = path.resolve(__dirname, "../../fixtures/basic-vault");
const clientAssetsDir = path.resolve(__dirname, "../render/client");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("buildSite: client-side search & tag filter UI (REQ-UX-001, REQ-UX-002)", () => {
  it("copies the client assets byte-identical to their source", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-search-ui-"));
    buildSite(vaultDir, outDir);

    for (const filename of ["filter.mjs", "search.mjs", "copy-id.mjs"]) {
      const copied = readFileSync(path.join(outDir, "assets", filename));
      const source = readFileSync(path.join(clientAssetsDir, filename));
      expect(copied.equals(source)).toBe(true);
    }
  });

  it("renders index.html with search box, tag filter container, per-note data-id, and the script tag", () => {
    outDir = mkdtempSync(path.join(tmpdir(), "enastro-search-ui-"));
    buildSite(vaultDir, outDir);

    const indexHtml = readFileSync(path.join(outDir, "index.html"), "utf-8");

    expect(indexHtml).toContain('id="search-box"');
    expect(indexHtml).toContain('id="tag-filters"');
    expect(indexHtml).toContain('id="no-results"');
    expect(indexHtml).toContain('<script type="module" src="assets/search.mjs"></script>');
    expect(indexHtml).toContain('data-id="note-a"');
    expect(indexHtml).toContain('data-id="note-b"');
  });
});

// Sanity check that this test file's own path resolution assumption
// (import.meta.url-based CLIENT_ASSETS_DIR in site.ts) is consistent with
// where the source client assets actually live.
describe("client assets location", () => {
  it("exists next to src/render/client", () => {
    const searchMjsPath = fileURLToPath(new URL("search.mjs", `file://${clientAssetsDir}/`));
    expect(() => readFileSync(searchMjsPath)).not.toThrow();
  });
});
