// Deterministically generates a large benchmark vault under
// fixtures/benchmark-vault/vault/ for performance testing (REQ-PERF-001,
// ADR-0012). The output is NOT committed to git (see .gitignore) — rerun
// this script to regenerate it. A fixed PRNG seed keeps the output
// reproducible across machines/runs, in the spirit of REQ-BUILD-001's
// determinism principle (this is a fixture generator, not the build itself,
// so it isn't literally REQ-BUILD-001, but the same "same input -> same
// output" property is useful for stable benchmark comparisons).
//
// Scale: 10,000 published notes, ~50,000 wikilink edges among them (per
// spec/07-performance.md §2 / ADR-0012), plus a small number of private
// notes referenced by published notes so the privacy invariant (REQ-SEC-001)
// can also be exercised at scale.
//
// Usage: node scripts/generate-benchmark-vault.mjs

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, "fixtures", "benchmark-vault", "vault");

const SEED = 0x5eed_1234;
const PUBLISHED_COUNT = 10_000;
const PRIVATE_COUNT = 100;
const TARGET_EDGE_COUNT = 50_000;
const AVG_OUT_DEGREE = TARGET_EDGE_COUNT / PUBLISHED_COUNT; // 5
const TAGS = [
  "astronomy",
  "physics",
  "biology",
  "history",
  "mathematics",
  "chemistry",
  "philosophy",
  "geography",
  "literature",
  "music",
];
const LOREM_WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
  "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
  "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo " +
  "consequat duis aute irure in reprehenderit voluptate velit esse cillum " +
  "eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident"
).split(" ");

// Small, fast, deterministic PRNG (mulberry32) — no crypto/uuid dependency
// needed since this is a fixture generator, not a security-sensitive path.
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function randInt(maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

function pick(array) {
  return array[randInt(array.length)];
}

function generateParagraph(sentenceCount) {
  const sentences = [];
  for (let s = 0; s < sentenceCount; s++) {
    const wordCount = 8 + randInt(10);
    const words = [];
    for (let w = 0; w < wordCount; w++) {
      words.push(pick(LOREM_WORDS));
    }
    const sentence = words.join(" ");
    sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".");
  }
  return sentences.join(" ");
}

function publishedNoteId(i) {
  return `note-${i}`;
}

function privateNoteId(i) {
  return `private-note-${i}`;
}

function generateVault() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let edgeCount = 0;

  for (let i = 0; i < PUBLISHED_COUNT; i++) {
    const id = publishedNoteId(i);
    const tagCount = 1 + randInt(3);
    const noteTags = new Set();
    while (noteTags.size < tagCount) {
      noteTags.add(pick(TAGS));
    }

    // Power-law-ish out-degree: mostly small, occasionally large "hub" notes.
    // Tuned so the total edge count lands close to TARGET_EDGE_COUNT.
    const isHub = rng() < 0.05;
    const degree = isHub
      ? Math.round(AVG_OUT_DEGREE * (2 + randInt(4)))
      : Math.max(0, Math.round(AVG_OUT_DEGREE * rng() * 1.6));

    const linkTargets = [];
    for (let l = 0; l < degree; l++) {
      // A small fraction of links point at private notes, to exercise
      // REQ-PUB-003/004/005 (edge removal + warning) at scale.
      const target =
        PRIVATE_COUNT > 0 && rng() < 0.01 ? privateNoteId(randInt(PRIVATE_COUNT)) : publishedNoteId(randInt(PUBLISHED_COUNT));
      if (target !== id) {
        linkTargets.push(target);
        edgeCount++;
      }
    }

    const bodyParagraphs = [generateParagraph(3 + randInt(3))];
    if (linkTargets.length > 0) {
      const linkSentence = linkTargets.map((target) => `[[${target}]]`).join(" ");
      bodyParagraphs.push(`See also: ${linkSentence}`);
    }

    const frontmatter = ["---", "publish: true", `tags: [${[...noteTags].join(", ")}]`, "---"].join("\n");
    const content = `${frontmatter}\n\n# Note ${i}\n\n${bodyParagraphs.join("\n\n")}\n`;
    writeFileSync(path.join(outDir, `${id}.md`), content, "utf-8");
  }

  for (let i = 0; i < PRIVATE_COUNT; i++) {
    const id = privateNoteId(i);
    const content = `---\npublish: false\n---\n\n# Private Note ${i}\n\n${generateParagraph(2)}\n`;
    writeFileSync(path.join(outDir, `${id}.md`), content, "utf-8");
  }

  console.log(
    `Generated ${PUBLISHED_COUNT} published + ${PRIVATE_COUNT} private notes, ~${edgeCount} wikilink edges, at ${outDir}`,
  );
}

generateVault();
