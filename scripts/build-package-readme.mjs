// Assembles packages/settlement-testbed/README.md from the marked sections of docs/agent-testbed.md.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("docs/agent-testbed.md", "utf8");
const target = "packages/settlement-testbed/README.md";
const sections = [...source.matchAll(/<!-- package-readme:start -->\n([\s\S]*?)<!-- package-readme:end -->/g)].map((m) => m[1].trim());
if (!sections.length) throw new Error("docs/agent-testbed.md has no package-readme markers");
const readme = [
  "# settlement-testbed",
  "",
  "[![npm](https://img.shields.io/npm/v/settlement-testbed.svg)](https://www.npmjs.com/package/settlement-testbed) [![CI](https://github.com/Lingikaushikreddy/Settlement-Village/actions/workflows/ci.yml/badge.svg)](https://github.com/Lingikaushikreddy/Settlement-Village/actions/workflows/ci.yml)",
  "",
  ...sections,
  "",
  "---",
  "",
  "Part of [Settlement](https://github.com/Lingikaushikreddy/Settlement-Village), a multi-agent village game and inspectable AI simulation lab. MIT licensed. This file is generated from `docs/agent-testbed.md`; edit that file.",
  "",
].join("\n");
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== readme) {
    console.error(`${target} is out of date. Run: npm run docs:package-readme`);
    process.exit(1);
  }
  console.log(`${target} is up to date`);
} else {
  writeFileSync(target, readme);
  console.log(`wrote ${target}`);
}
