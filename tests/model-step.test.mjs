import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  advance,
  verifyReplay,
  checkInvariants,
} from "../lib/sim/engine.ts";
import { socialInput, applyModelStep } from "../lib/agent/social.ts";

function pending() {
  let r = createRun({ seed: 42, maxTicks: 32 });
  for (let i = 0; i < 8; i++) r = advance(r);
  return r;
}
function record(r, action = "reject_claim") {
  const input = socialInput(r);
  return {
    tick: 9,
    actor: input.actor,
    incidentId: input.incidentId,
    action,
    summary: "Use the evidence before committing resources.",
    evidenceIds: input.input.evidenceIds.slice(0, 1),
    model: "test-model",
    requestId: "fixture",
    usage: { inputTokens: 100, outputTokens: 30 },
    costUSD: 0.002,
  };
}
test("model observes only the recipient perspective and explicit allowed actions", () => {
  const r = pending(),
    s = socialInput(r);
  const text = JSON.stringify(s.input.observation);
  assert.equal(s.actor, "theo");
  assert.ok(s.input.allowedActions.includes("reject_claim"));
  assert.ok(!text.includes("offerPrice"));
  assert.ok(!text.includes("attacker"));
  assert.ok(!text.includes("harm"));
  assert.ok(
    s.input.evidenceIds.every((id) =>
      r.events.some(
        (e) =>
          e.id === id &&
          e.tick <= 8 &&
          (e.visibility === "public" || e.audience.includes(s.actor)),
      ),
    ),
  );
});
test("a validated model choice changes the decision and replays without another provider call", () => {
  const r = pending(),
    before = structuredClone(r),
    next = applyModelStep(r, record(r));
  assert.equal(next.incidents[0].decision, "refused");
  assert.equal(next.modelCalls, 1);
  assert.equal(next.socialDecisions.length, 1);
  assert.equal(next.estimatedCost, 0.002);
  assert.equal(verifyReplay(next).ok, true);
  assert.deepEqual(r, before);
  assert.equal(checkInvariants(next).length, 0);
  const changed = structuredClone(next);
  changed.socialDecisions[0].action = "accept_claim";
  assert.equal(verifyReplay(changed).ok, false);
});
test("private or fabricated evidence, stale ticks and nonpending incidents cannot drive model actions", () => {
  const r = pending();
  assert.throws(
    () => applyModelStep(r, { ...record(r), evidenceIds: ["fake"] }),
    /evidence/i,
  );
  assert.throws(() => applyModelStep(r, { ...record(r), tick: 10 }), /tick/i);
  assert.throws(
    () => applyModelStep(r, { ...record(r), actor: "mira" }),
    /recipient/i,
  );
  assert.throws(() => socialInput(createRun()), /pending/i);
  const next = applyModelStep(r, record(r));
  assert.throws(() => applyModelStep(next, record(r)), /pending|tick/i);
});
test("tampered model records report failed verification without throwing", () => {
  const r = pending(),
    next = applyModelStep(r, record(r));
  next.socialDecisions[0].evidenceIds = ["fabricated"];
  assert.equal(verifyReplay(next).ok, false);
});
