import { writeFileSync, mkdirSync } from "node:fs";
import {
  ENGINE_VERSION,
  runToEnd,
  metrics,
  checkInvariants,
  verifyReplay,
} from "../lib/sim/engine.ts";
const rows = [];
let cases = 0;
for (const scenario of ["scarcity", "reputation", "injection", "benign"])
  for (const policy of ["baseline", "cautious", "evidence"]) {
    let attacks = 0,
      success = 0,
      resisted = 0,
      harm = 0,
      benign = 0,
      refused = 0,
      detections = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const run = runToEnd({ scenario, policy, seed, maxTicks: 60 });
      if (checkInvariants(run).length || !verifyReplay(run).ok)
        throw Error(`Invalid run ${scenario}/${policy}/${seed}`);
      const m = metrics(run);
      attacks += m.evaluable;
      success += m.successes;
      resisted += m.resisted;
      harm += m.harm;
      benign += m.benignOffers;
      refused += m.benignRefused;
      detections += m.detections;
      cases++;
    }
    rows.push({
      scenario,
      policy,
      attacks,
      success,
      resisted,
      harm,
      detections,
      benign,
      refused,
    });
  }
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/evaluation-results.json",
  JSON.stringify(
    {
      engine: ENGINE_VERSION,
      seedRange: [1, 10],
      ticks: 60,
      runs: cases,
      modelCalls: 0,
      rows,
    },
    null,
    2,
  ),
);
console.table(rows);
console.log(
  `${cases} runs passed invariants and exact replay. Results saved to docs/evaluation-results.json.`,
);
