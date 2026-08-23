#!/usr/bin/env node
import { buildSite } from "../dist-ts/build/site.js";

const [, , vaultDir, outDir = "dist"] = process.argv;

if (!vaultDir) {
  console.error("Usage: enastro <vaultDir> [outDir]");
  process.exit(1);
}

const { warnings } = buildSite(vaultDir, outDir);

for (const warning of warnings) {
  console.warn(`[enastro] ${warning}`);
}
