import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import {
  createEvaluationManifest,
  evaluateSuite,
  verifyEvaluationReport,
} from "../lib/sim/evaluation.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === "--verify") {
    if (statSync(args[1]).size > 2 * 1024 * 1024) {
      throw new Error("Evaluation reports must be at most 2 MB.");
    }
    const input = JSON.parse(readFileSync(args[1], "utf8"));
    const result = await verifyEvaluationReport(input);
    if (!result.ok) throw new Error(result.reason);
    console.log(
      `Verified ${result.report.cases.length} cases. ${result.reason}.`,
    );
    return;
  }
  if (args.length) {
    throw new Error(
      "Usage: npm run evaluate [-- --verify path/to/report.json]",
    );
  }
  const report = await evaluateSuite(createEvaluationManifest("all"));
  mkdirSync("docs", { recursive: true });
  writeFileSync(
    "docs/evaluation-results.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.table(report.rows);
  console.log(
    `${report.cases.length} runs passed invariants and exact replay. Compact reproducible report saved to docs/evaluation-results.json.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
