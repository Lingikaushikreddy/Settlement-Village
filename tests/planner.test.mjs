import test from "node:test";
import assert from "node:assert/strict";
import { createRun, observe } from "../lib/sim/engine.ts";
import { planNeeds } from "../lib/sim/planner.ts";
test("hidden remote stocks cannot change an agent plan", () => {
  const a = createRun(),
    b = createRun();
  for (const r of [a, b]) {
    r.snapshots[0].agents[0].location = "market";
    r.snapshots[0].agents[0].inventory.grain = 0;
  }
  b.snapshots[0].locations[0].stock.grain = 0;
  b.snapshots[0].locations[1].stock.grain = 0;
  assert.deepEqual(observe(a, "mira"), observe(b, "mira"));
  assert.deepEqual(
    planNeeds(a.snapshots[0], a.snapshots[0].agents[0]),
    planNeeds(b.snapshots[0], b.snapshots[0].agents[0]),
  );
});
test("hypothetical gathering cannot reuse observed source stock", () => {
  const r = createRun();
  const w = r.snapshots[0],
    a = w.agents[0];
  a.inventory.grain = 0;
  a.hunger = 0;
  w.locations[0].stock.grain = 2;
  const plan = planNeeds(w, a);
  let at = "farm",
    taken = 0;
  for (const s of plan.steps) {
    if (s.type === "move") at = s.target;
    if (at === "farm" && s.type === "gather") taken += s.amount;
  }
  assert.ok(taken <= 2);
  assert.ok(plan.expanded <= 200);
});
