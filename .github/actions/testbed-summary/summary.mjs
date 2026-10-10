// Renders a settlement-testbed report as a GitHub job summary and sets action outputs.
// Usage: node summary.mjs <report.json> [<cli-exit-code>]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [reportPath = "settlement-agent-report.json", exitCode = "0"] = process.argv.slice(2);
const POLICY = { baseline: "Trust first", cautious: "Cautious", evidence: "Check evidence" };
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}% (${n}/${d})` : "n/a");
const lines = ["## Settlement agent testbed", ""];
const outputs = [`report-path=${reportPath}`];

if (!existsSync(reportPath)) {
  lines.push(`No report was written (CLI exit code ${exitCode}). Check the step log: the agent may have been unreachable or an option invalid.`);
} else {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const sum = (k) => report.rows.reduce((n, r) => n + r[k], 0);
  const overall = {
    attackSuccess: sum("evaluable") ? (sum("successes") + sum("unresolved")) / sum("evaluable") : null,
    honestRefusal: sum("benignOffers") ? (sum("benignRefused") + sum("honestUnanswered")) / sum("benignOffers") : null,
    invalid: sum("decisions") ? sum("invalidDecisions") / sum("decisions") : null,
  };
  lines.push(`Agent **${report.agent.name}** · ${report.cases.length} cases · engine ${report.engineVersion}`, "");
  lines.push("| Scenario | Attack success | Honest refusal | Invalid |", "| --- | --- | --- | --- |");
  for (const row of report.rows) {
    lines.push(`| ${row.scenario} (${row.runCount} runs) | ${pct(row.successes + row.unresolved, row.evaluable)} | ${pct(row.benignRefused + row.honestUnanswered, row.benignOffers)} | ${pct(row.invalidDecisions, row.decisions)} |`);
    for (const b of report.baselines.filter((b) => b.scenario === row.scenario))
      lines.push(`| ↳ ${POLICY[b.policy]} | ${pct(b.successes, b.evaluable)} | ${pct(b.benignRefused, b.benignOffers)} | — |`);
  }
  const fmt = (v) => (v === null ? "n/a" : `${(100 * v).toFixed(1)}%`);
  lines.push("", `**Overall:** attack success ${fmt(overall.attackSuccess)} · honest refusal ${fmt(overall.honestRefusal)} · invalid ${fmt(overall.invalid)}`);
  lines.push("", exitCode === "1" ? "❌ A threshold was exceeded; see the step log for which one." : exitCode === "0" ? "✅ All configured thresholds passed." : `⚠️ CLI exit code ${exitCode}.`);
  lines.push("", "Verify this report anywhere with `npx settlement-testbed --verify <report.json>`. Scores apply to these authored scenarios only; they are not a general safety certification.");
  outputs.push(`attack-success=${overall.attackSuccess ?? ""}`, `honest-refusal=${overall.honestRefusal ?? ""}`, `invalid=${overall.invalid ?? ""}`);
}

process.stdout.write(lines.join("\n") + "\n");
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs.join("\n") + "\n");
