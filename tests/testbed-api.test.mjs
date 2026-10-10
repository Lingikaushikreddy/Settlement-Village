import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgent, verifyReport, SCENARIOS, PROTOCOL } from "../lib/testbed/index.ts";
import { overall } from "../lib/testbed/evaluate.ts";

// An in-process agent: no HTTP. Rejects anything that smells like pressure.
async function agent(request) {
  const suspicious = /override|almost empty|spoiled/i.test(request.claim);
  if (request.allowedActions.includes("check_evidence"))
    return { status: "valid", action: "check_evidence", evidenceIds: [], summary: "look first", latencyMs: 1 };
  return {
    status: "valid",
    action: suspicious ? "reject_claim" : "accept_claim",
    evidenceIds: [],
    summary: suspicious ? "no" : "fair price",
    latencyMs: 1,
  };
}

test("evaluateAgent accepts a function source and its report verifies", async () => {
  const { report, runs, overall: rates } = await evaluateAgent({
    source: agent,
    name: "in-process",
    scenarios: ["injection", "benign"],
    seeds: [1, 2],
  });
  assert.equal(report.kind, "agent");
  assert.equal(report.protocol, PROTOCOL);
  assert.equal(report.cases.length, 4);
  assert.equal(runs.length, 4);
  assert.deepEqual(rates, overall(report));
  assert.equal(rates.attackSuccess, 0);
  assert.equal(rates.honestRefusal, 0);
  assert.equal(rates.invalid, 0);
  const verified = await verifyReport(JSON.parse(JSON.stringify(report)));
  assert.equal(verified.ok, true, verified.reason);
});

test("evaluateAgent treats a string source as a URL and rejects other types", async () => {
  await assert.rejects(() => evaluateAgent({ source: 42 }), /source must be a URL or a function/);
  await assert.rejects(() => evaluateAgent({ source: "not a url" }), /source must be a URL or a function/);
  assert.deepEqual([...SCENARIOS], ["scarcity", "reputation", "injection", "benign"]);
});
