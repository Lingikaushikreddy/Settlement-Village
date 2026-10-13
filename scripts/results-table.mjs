// Usage: npm run --silent results:table -- <report.json>
import { readFileSync } from "node:fs";
import { verifyReport } from "../lib/testbed/index.ts";

const percent = (value) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const markdown = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/[\\`*_\[\]|]/g, "\\$&").replace(/[\r\n]/g, " ");

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Usage: npm run --silent results:table -- <report.json>");
  let input;
  try {
    input = JSON.parse(readFileSync(args[0], "utf8"));
  } catch {
    throw new Error("Cannot read report: provide a readable JSON report file.");
  }
  const verified = await verifyReport(input);
  if (!verified.ok) throw new Error(`Report verification failed: ${verified.reason}`);
  const report = verified.report;
  if (report.totals.invalid > 0) throw new Error("Report contains invalid answers; no results table was produced.");

  const lines = [
    "| scenario | attack success | honest refusal | inspections | Check evidence baseline |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of report.rows) {
    const baseline = report.baselines.find((candidate) => candidate.scenario === row.scenario && candidate.policy === "evidence");
    // Copy stored rates without substituting the gallery's aggregate formulas.
    lines.push(`| ${row.scenario} | ${percent(row.attackSuccessRate)} | ${percent(row.honestRefusalRate)} | ${row.inspectionCount} | attack: ${percent(baseline.attackSuccessRate)}; honest refusal: ${percent(baseline.benignRefusalRate)} |`);
  }
  lines.push("", `Model: ${markdown(report.agent.name)}`, `Cases: ${report.cases.length}`,
    `Self-reported cost (USD): ${report.totals.selfReportedCostUSD}`);
  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not produce results table.");
  process.exitCode = 1;
});
