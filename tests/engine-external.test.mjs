import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_ENGINE_VERSION,
  ENGINE_VERSION,
  advance,
  checkInvariants,
  createRun,
  metrics,
  policyName,
  runToEnd,
  verifyReplay,
} from "../lib/sim/engine.ts";
import { socialInput, socialInputs } from "../lib/agent/social.ts";

const SCENARIOS = ["scarcity", "reputation", "injection", "benign"];
const external = (scenario = "injection", seed = 1) =>
  createRun({ scenario, policy: "external", seed, maxTicks: 60 });
function untilPending(run) {
  while (run.status === "active" && socialInputs(run).length === 0)
    run = advance(run);
  return run;
}
function finish(run) {
  while (run.status === "active") run = advance(run);
  return run;
}
function decision(run, action, extra = {}) {
  const [context] = socialInputs(run);
  return {
    tick: run.snapshots.length,
    actor: context.actor,
    incidentId: context.incidentId,
    action,
    summary: action === "invalid" ? "" : "test decision",
    evidenceIds: [],
    model: "test-agent",
    requestId: "fixture",
    usage: { inputTokens: 0, outputTokens: 0 },
    costUSD: 0,
    ...extra,
  };
}

test("external runs are stamped and never decide claims on their own", () => {
  const run = finish(external());
  assert.equal(run.engineVersion, AGENT_ENGINE_VERSION);
  assert.ok(run.incidents.length > 0);
  for (const incident of run.incidents) {
    assert.equal(incident.decision, "pending");
    assert.equal(incident.outcome, "unresolved");
    assert.equal(incident.harm, 0);
  }
  const m = metrics(run);
  assert.equal(m.resisted, 0);
  assert.equal(m.successes, 0);
  assert.equal(m.unresolved, run.incidents.length);
  assert.deepEqual(checkInvariants(run), []);
  assert.ok(verifyReplay(run).ok);
});

test("authored scenarios never have two claims pending in one tick", () => {
  for (const scenario of SCENARIOS)
    for (let seed = 1; seed <= 10; seed++) {
      let run = external(scenario, seed);
      while (run.status === "active") {
        assert.ok(socialInputs(run).length <= 1, `${scenario}/${seed}`);
        run = advance(run);
      }
    }
});

test("socialInput is the first of socialInputs", () => {
  const run = untilPending(external());
  const inputs = socialInputs(run);
  assert.equal(inputs.length, 1);
  assert.deepEqual(socialInput(run), inputs[0]);
  assert.ok(inputs[0].input.allowedActions.includes("check_evidence"));
});

test("an invalid decision is recorded and leaves the claim unanswered", () => {
  const run = untilPending(external());
  const d = decision(run, "invalid", { invalidReason: "timeout" });
  const next = advance(run, undefined, d);
  const incident = next.incidents.find((i) => i.id === d.incidentId);
  assert.equal(incident.decision, "pending");
  const logged = next.decisions.find(
    (x) => x.tick === d.tick && x.actor === d.actor,
  );
  assert.equal(logged.selected, "No valid answer");
  assert.match(logged.summary, /timeout/);
  assert.deepEqual(next.socialDecisions.at(-1), d);
  assert.equal(next.engineVersion, AGENT_ENGINE_VERSION);
  assert.ok(verifyReplay(finish(next)).ok);
});

test("an explicit rejection resists an injection without harm", () => {
  let run = untilPending(external("injection"));
  run = finish(advance(run, undefined, decision(run, "reject_claim")));
  assert.equal(run.incidents[0].decision, "refused");
  assert.equal(run.incidents[0].outcome, "resisted");
  assert.equal(run.incidents[0].harm, 0);
  assert.ok(verifyReplay(run).ok);
});

test("invalid decisions cannot cite evidence or carry a reason when valid", () => {
  const run = untilPending(external());
  assert.throws(
    () =>
      advance(
        run,
        undefined,
        decision(run, "invalid", { invalidReason: "timeout", evidenceIds: ["e-1"] }),
      ),
    /evidence/i,
  );
  assert.throws(
    () =>
      advance(
        run,
        undefined,
        decision(run, "reject_claim", { invalidReason: "timeout" }),
      ),
    /invalid reason/i,
  );
});

test("built-in policies keep their engine version, and names resolve", () => {
  assert.equal(runToEnd({ policy: "evidence", seed: 1 }).engineVersion, ENGINE_VERSION);
  assert.equal(policyName("evidence"), "Check evidence");
  assert.equal(policyName("external"), "Your agent");
  assert.equal(policyName("external", "my-agent"), "my-agent");
});
