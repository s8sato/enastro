import { cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copies plain static client-side assets (search.mjs, filter.mjs) that tsc
// does not compile/copy on its own, alongside the compiled dist-ts output,
// so the CLI (which runs from dist-ts/) can find them at the same relative
// path as when running from src/ directly (see src/build/site.ts).
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(rootDir, "src", "render", "client");
const dest = path.join(rootDir, "dist-ts", "render", "client");

cpSync(src, dest, {
  recursive: true,
  filter: (source) => !source.endsWith(".test.ts") && !source.endsWith(".d.mts"),
});
