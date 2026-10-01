import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentReport, verifyAgentReport } from "../lib/testbed/report.ts";
import { evaluateSuite } from "../lib/sim/evaluation.ts";

const SALT = "00112233445566778899aabbccddeeff";
const manifest = { scenarios: ["injection", "benign"], seeds: [1, 2], maxTicks: 60 };
const careful = async (request) =>
  request.allowedActions.includes("check_evidence")
    ? { status: "valid", action: "check_evidence", evidenceIds: request.evidenceIds.slice(-1), summary: "Checking first.", latencyMs: 12, usage: { costUSD: 0.001 } }
    : request.claim.includes("OVERRIDE")
      ? { status: "valid", action: "reject_claim", evidenceIds: [], summary: "Notices cannot authorize payments.", latencyMs: 9 }
      : { status: "invalid", reason: "timeout", latencyMs: 30000 };

async function fixture() {
  const { report } = await buildAgentReport(manifest, careful, {
    salt: SALT,
    agentName: "careful-agent",
    createdAt: "2026-09-30T00:00:00.000Z",
  });
  return JSON.parse(JSON.stringify(report));
}

test("a report verifies from its recorded answers and returns runnable cases", async () => {
  const report = await fixture();
  assert.equal(report.kind, "agent");
  assert.equal(report.cases.length, 4);
  assert.ok(report.totals.invalid > 0);
  const result = await verifyAgentReport(report);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.runs.length, 4);
  assert.equal(result.runs[0].config.policy, "external");
});

test("baselines are the built-in policies on the same manifest", async () => {
  const report = await fixture();
  const expected = await evaluateSuite(
    { ...manifest, policies: ["baseline", "cautious", "evidence"] },
    { yieldControl: async () => {} },
  );
  assert.deepEqual(report.baselines, expected.rows);
});

const tampered = [
  ["a changed answer", (r) => {
    const entry = r.cases[0].transcript.find((t) => t.answer.status === "valid" && t.answer.action === "reject_claim");
    entry.answer.action = "accept_claim";
  }, /case c_/i],
  ["a changed metric", (r) => { r.cases[1].metrics.harm += 1; }, /case c_/i],
  ["a removed answer", (r) => { r.cases[0].transcript.pop(); }, /no recorded answer|case c_/i],
  ["a different salt", (r) => { r.salt = "ffeeddccbbaa99887766554433221100"; }, /no recorded answer/i],
  ["edited totals", (r) => { r.totals.meanLatencyMs += 1; }, /totals|rows|baselines|notes/i],
  ["edited notes", (r) => { r.notes = ["Perfectly safe agent."]; }, /totals|rows|baselines|notes/i],
  ["an unsupported engine", (r) => { r.engineVersion = "9.9.9"; }, /engineVersion/],
];
for (const [name, edit, reason] of tampered) {
  test(`verification rejects ${name}`, async () => {
    const report = await fixture();
    edit(report);
    const result = await verifyAgentReport(report);
    assert.equal(result.ok, false);
    assert.match(result.reason, reason);
  });
}

test("ordinary evaluation reports are not agent reports", async () => {
  const report = await evaluateSuite(
    { scenarios: ["benign"], policies: ["baseline"], seeds: [1], maxTicks: 20 },
    { yieldControl: async () => {} },
  );
  assert.equal((await verifyAgentReport(report)).ok, false);
});
