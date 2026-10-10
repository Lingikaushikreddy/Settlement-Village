import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRun, runToEnd, definitionFor, scenarioInfo, metrics, verifyReplay, checkInvariants } from "../lib/sim/engine.ts";
import { verifyEvaluationReport } from "../lib/sim/evaluation.ts";
import { BUILT_IN_IDS, BUILT_IN_SCENARIOS } from "../lib/sim/scenarios/index.ts";

test("scenarioInfo is derived from the built-in definitions", () => {
  for (const id of BUILT_IN_IDS) {
    assert.equal(scenarioInfo[id].name, BUILT_IN_SCENARIOS[id].name);
    assert.equal(scenarioInfo[id].claim, BUILT_IN_SCENARIOS[id].claim);
  }
});

test("a built-in run carries no definition key and resolves its built-in", () => {
  const run = runToEnd({ scenario: "injection", seed: 3, policy: "evidence", maxTicks: 40 });
  assert.ok(!("definition" in run), "built-in runs keep their JSON shape");
  assert.equal(definitionFor(run).id, "injection");
  assert.equal(metrics(run).attacks, run.incidents.length);
  assert.deepEqual(checkInvariants(run), []);
  assert.equal(verifyReplay(run).ok, true);
});

test("a run on a custom definition carries it and reads its kind", () => {
  const custom = { ...BUILT_IN_SCENARIOS.benign, id: "fair-deal", name: "Fair deal" };
  const run = runToEnd({ scenario: "fair-deal", seed: 1, policy: "baseline", maxTicks: 40 }, custom);
  assert.equal(run.definition.id, "fair-deal");
  assert.ok(run.incidents.length > 0);
  assert.equal(metrics(run).attacks, 0);
  assert.equal(metrics(run).benignOffers, run.incidents.length);
  assert.equal(verifyReplay(run).ok, true);
  // Without its definition an unknown id is sanitised to scarcity, the engine's existing
  // contract for stored configs; the CLI and API validate ids before creating runs.
  assert.equal(createRun({ scenario: "fair-deal", seed: 1, policy: "baseline", maxTicks: 40 }).config.scenario, "scarcity");
  assert.throws(() => createRun({ scenario: "injection", seed: 1, policy: "baseline", maxTicks: 40 }, custom), /does not match/);
});

test("the checked-in reference report still reproduces exactly", async () => {
  const report = JSON.parse(readFileSync("docs/evaluation-results.json", "utf8"));
  const result = await verifyEvaluationReport(report, { yieldControl: async () => {} });
  assert.equal(result.ok, true, result.reason);
});
