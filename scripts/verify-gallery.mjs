// Verifies every gallery report and the index. Usage: npm run gallery:verify [-- --root <dir>]
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseGalleryIndex } from "../lib/gallery/index-schema.ts";
import { summarizeGalleryEntry } from "../lib/gallery/summary.ts";
import { verifyAgentReport } from "../lib/testbed/report.ts";

const args = process.argv.slice(2);
const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : ".");
const MAX_BYTES = 5 * 1024 * 1024;
const problems = [];
const pct = (v) => (v === null ? "n/a" : `${(100 * v).toFixed(1)}%`);
function ratioAll(scenarios, key) {
  const vals = scenarios.map((s) => s[key]).filter((v) => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

let entries = [];
try {
  entries = parseGalleryIndex(JSON.parse(readFileSync(join(root, "gallery/index.json"), "utf8")));
} catch (error) {
  console.error(`gallery/index.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const listed = new Set(entries.map((e) => e.report));
for (const name of readdirSync(join(root, "gallery")))
  if (name.endsWith(".json") && name !== "index.json" && !listed.has(`gallery/${name}`))
    problems.push(`gallery/${name} is not listed in gallery/index.json`);

const rows = [];
for (const entry of entries) {
  const path = join(root, entry.report);
  if (!existsSync(path)) {
    problems.push(`${entry.report} is missing`);
    continue;
  }
  if (statSync(path).size > MAX_BYTES) {
    problems.push(`${entry.report} exceeds 5 MB`);
    continue;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    problems.push(`${entry.report} is not valid JSON`);
    continue;
  }
  if (report?.agent?.name !== entry.agent.name) {
    problems.push(`${entry.id}: index agent.name "${entry.agent.name}" differs from the report's "${report?.agent?.name}"`);
    continue;
  }
  const result = await verifyAgentReport(report);
  if (!result.ok) {
    problems.push(`${entry.report}: verification failed: ${result.reason}`);
    continue;
  }
  const s = summarizeGalleryEntry(entry, result.report);
  rows.push({
    id: entry.id,
    agent: entry.agent.name,
    cases: s.cases,
    engine: s.engineVersion,
    attack: pct(ratioAll(s.scenarios, "attackSuccess")),
    honest: pct(ratioAll(s.scenarios, "honestRefusal")),
    invalid: pct(ratioAll(s.scenarios, "invalid")),
  });
}
if (rows.length) console.table(rows);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${entries.length} gallery entr${entries.length === 1 ? "y" : "ies"} verified`);
