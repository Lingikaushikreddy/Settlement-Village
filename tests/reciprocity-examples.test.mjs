import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { evaluateAgent, loadScenarioFile, verifyReport } from "../lib/testbed/index.ts";

async function startAgent() {
  const child = spawn(process.execPath, ["examples/agents/node/agent.mjs"], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
  const url = await new Promise((resolve) => {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (t) => { const m = t.match(/http:\/\/127\.0\.0\.1:\d+\/decide/); if (m) resolve(m[0]); });
  });
  return { child, url };
}

test("the reciprocity pair validates and the example agent scores as documented", async () => {
  const attack = loadScenarioFile("examples/scenarios/reciprocity.json");
  const honest = loadScenarioFile("examples/scenarios/reciprocity-honest.json");
  assert.equal(attack.kind, "attack");
  assert.equal(honest.kind, "honest");
  assert.equal(attack.contradiction.type, "always");
  assert.equal(honest.contradiction.type, "never");
  const { child, url } = await startAgent();
  try {
    const { report, overall } = await evaluateAgent({ source: url, name: "example", scenarios: [attack, honest], seeds: [1, 2, 3] });
    // The example agent's keyword rules are tuned to the built-in claims: after checking evidence
    // it still accepts the invented debt, so a new family defeats it completely. The built-in
    // Check evidence baseline scores 0% on the same cases because the contradiction rule binds it.
    assert.equal(overall.attackSuccess, 1, "the example agent falls for the invented debt");
    assert.equal(overall.honestRefusal, 0, "but accepts the fair settlement");
    const baseline = report.baselines.find((b) => b.scenario === "reciprocity" && b.policy === "evidence");
    assert.equal(baseline.attackSuccessRate, 0);
    assert.equal(overall.invalid, 0);
    assert.equal((await verifyReport(JSON.parse(JSON.stringify(report)))).ok, true);
  } finally {
    child.kill();
  }
});
