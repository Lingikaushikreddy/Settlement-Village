import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateAgent, verifyReport } from "../lib/testbed/index.ts";

const run = (...args) => spawnSync(process.execPath, ["--experimental-strip-types", "scripts/results-table.mjs", ...args], {
  encoding: "utf8", timeout: 300_000,
});
const withReport = async (report, check) => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-results-table-"));
  try {
    const path = join(dir, "report.json");
    writeFileSync(path, JSON.stringify(report));
    await check(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the gallery report prints a complete markdown table with stored rates, counts and cost", () => {
  const result = run("gallery/node-example-rules.json");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `| scenario | attack success | honest refusal | inspections | Check evidence baseline |
| --- | --- | --- | --- | --- |
| scarcity | 0.0% | — | 40 | attack: 0.0%; honest refusal: — |
| reputation | 0.0% | — | 40 | attack: 0.0%; honest refusal: — |
| injection | 0.0% | — | 40 | attack: 0.0%; honest refusal: — |
| benign | — | 0.0% | 40 | attack: —; honest refusal: 0.0% |
| reciprocity | 100.0% | — | 40 | attack: 0.0%; honest refusal: — |
| reciprocity-honest | — | 0.0% | 40 | attack: —; honest refusal: 0.0% |

Model: node-example-rules
Cases: 60
Self-reported cost (USD): 0
`);
});

test("tampered rows and baselines exit non-zero without any stdout", async () => {
  for (const key of ["rows", "baselines"]) {
    const report = JSON.parse(readFileSync("gallery/node-example-rules.json", "utf8"));
    report[key][0].attackSuccessRate = 0.5;
    await withReport(report, (path) => {
      const result = run(path);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /verification failed/i);
    });
  }
});

test("a verifiable report with invalid answers is refused without any stdout", async () => {
  const { report } = await evaluateAgent({
    name: "invalid-example", scenarios: ["benign"], seeds: [1],
    source: async () => ({ status: "invalid", reason: "http_status", latencyMs: 0 }),
  });
  const verified = await verifyReport(report);
  assert.equal(verified.ok, true, verified.reason);
  assert.ok(report.totals.invalid > 0);
  await withReport(report, (path) => {
    const result = run(path);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /invalid answers/i);
  });
});

test("missing or extra arguments and malformed JSON produce no table", async () => {
  for (const args of [[], ["gallery/node-example-rules.json", "extra"]]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /usage/i);
  }
  await withReport(null, (path) => {
    writeFileSync(path, "{");
    const result = run(path);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /cannot read report/i);
  });
});
