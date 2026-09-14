import test from "node:test";
import assert from "node:assert/strict";
const E = await import("../lib/sim/engine.ts").catch(() => ({}));
const config = {
  seed: 42,
  scenario: "scarcity",
  policy: "baseline",
  maxTicks: 60,
};
function create(options = {}) {
  assert.equal(typeof E.createRun, "function", "createRun must be implemented");
  return E.createRun({ ...config, ...options });
}

test("same configuration produces identical state and event evidence", () => {
  let a = create(),
    b = create();
  for (let i = 0; i < 40; i++) {
    a = E.advance(a);
    b = E.advance(b);
  }
  assert.deepEqual(a.snapshots, b.snapshots);
  assert.deepEqual(a.events, b.events);
  assert.equal(E.verifyReplay(a).ok, true);
});
test("all four scenarios preserve integer balances over multiple seeds", () => {
  for (const scenario of ["scarcity", "reputation", "injection", "benign"])
    for (let seed = 1; seed <= 8; seed++) {
      let r = create({ scenario, seed });
      for (let i = 0; i < 60; i++) r = E.advance(r);
      for (const w of r.snapshots) {
        for (const a of w.agents)
          for (const v of Object.values(a.inventory))
            assert.ok(Number.isInteger(v) && v >= 0);
      }
      assert.deepEqual(E.checkInvariants(r), []);
    }
});
test("an agent observation excludes other inventories, private memories, and attacker labels", () => {
  let r = create();
  for (let i = 0; i < 15; i++) r = E.advance(r);
  const o = E.observe(r, "mira");
  assert.equal(o.self.id, "mira");
  assert.ok(o.neighbors.every((a) => !("inventory" in a) && !("role" in a)));
  assert.ok(o.memories.every((m) => m.owner === "mira"));
  assert.ok(!("incidents" in o));
  assert.ok(!("snapshots" in o));
});
test("trade validation rejects insufficient inventory and duplicate execution", () => {
  const r = create();
  const w = structuredClone(r.snapshots[0]);
  const command = {
    id: "trade-1",
    actor: "mira",
    type: "trade",
    target: "theo",
    give: { grain: 999 },
    receive: { coins: 1 },
  };
  const before = JSON.stringify(w);
  assert.equal(E.applyAction(w, command).ok, false);
  assert.equal(JSON.stringify(w), before);
  assert.equal(
    E.applyAction(w, {
      id: "offer-1",
      actor: "theo",
      type: "offer",
      target: "mira",
      give: { coins: 2 },
      receive: { grain: 1 },
    }).ok,
    true,
  );
  const valid = {
    ...command,
    offerId: "offer-1",
    give: { grain: 1 },
    receive: { coins: 2 },
  };
  assert.equal(E.applyAction(w, valid).ok, true);
  const after = JSON.stringify(w);
  assert.equal(E.applyAction(w, valid).ok, false);
  assert.equal(JSON.stringify(w), after);
});
test("two conflicting transfers never spend the same grain twice", () => {
  const w = structuredClone(create().snapshots[0]);
  w.agents.find((a) => a.id === "mira").inventory.grain = 1;
  E.applyAction(w, {
    id: "oa",
    actor: "theo",
    type: "offer",
    target: "mira",
    give: { coins: 1 },
    receive: { grain: 1 },
  });
  E.applyAction(w, {
    id: "ob",
    actor: "ada",
    type: "offer",
    target: "mira",
    give: { coins: 1 },
    receive: { grain: 1 },
  });
  const base = {
    actor: "mira",
    type: "trade",
    give: { grain: 1 },
    receive: { coins: 1 },
  };
  assert.equal(
    E.applyAction(w, { ...base, id: "a", target: "theo", offerId: "oa" }).ok,
    true,
  );
  assert.equal(
    E.applyAction(w, { ...base, id: "b", target: "ada", offerId: "ob" }).ok,
    false,
  );
  assert.equal(w.agents.find((a) => a.id === "mira").inventory.grain, 0);
});
test("tampered playback fails checksum verification", () => {
  const r = E.advance(create());
  r.snapshots[1].agents[0].inventory.coins++;
  assert.equal(E.verifyReplay(r).ok, false);
});
test("evidence checks leave detection evidence and benign controls retain their own denominator", () => {
  let r = create({ policy: "evidence" });
  for (let i = 0; i < 60; i++) r = E.advance(r);
  assert.ok(r.incidents.length > 0);
  assert.ok(r.incidents.some((i) => i.detectedTick !== null));
  assert.ok(
    r.incidents.every((i) =>
      ["succeeded", "resisted", "unresolved"].includes(i.outcome),
    ),
  );
  let b = create({ scenario: "benign", policy: "evidence" });
  for (let i = 0; i < 60; i++) b = E.advance(b);
  assert.equal(E.metrics(b).attacks, 0);
  assert.ok(E.metrics(b).benignOffers > 0);
});
test("completed runs cannot advance and intervention is applied at the next boundary", () => {
  let r = create({ maxTicks: 20 });
  const initial = r.snapshots[0].locations.find((l) => l.id === "granary").stock
    .grain;
  r = E.advance(r, "add-grain");
  assert.equal(
    r.snapshots[1].locations.find((l) => l.id === "granary").stock.grain,
    initial + 12,
  );
  for (let i = 0; i < 19; i++) r = E.advance(r);
  assert.equal(r.status, "completed");
  assert.deepEqual(E.advance(r), r);
});
test("replay detects missing incident and decision evidence", () => {
  let r = create();
  for (let i = 0; i < 30; i++) r = E.advance(r);
  r.events = [];
  r.decisions = [];
  r.incidents = [];
  assert.equal(E.verifyReplay(r).ok, false);
});
test("reputation cases never target the seller himself", () => {
  for (let seed = 0; seed < 10; seed++) {
    let r = create({ seed, scenario: "reputation" });
    for (let i = 0; i < 30; i++) r = E.advance(r);
    assert.ok(r.incidents.every((i) => i.target !== "theo"));
  }
});
test("new claims are not used in same-tick decision evidence", () => {
  let r = create();
  for (let i = 0; i < 10; i++) r = E.advance(r);
  for (const d of r.decisions)
    for (const id of d.evidenceIds) {
      const e = r.events.find((e) => e.id === id);
      assert.ok(
        e.tick < d.tick || (e.type === "inspection" && e.actor === d.actor),
      );
    }
});
test("configuration only accepts declared scenario and policy IDs", () => {
  assert.equal(
    create({ scenario: "constructor", policy: "toString" }).config.scenario,
    "scarcity",
  );
  assert.equal(
    create({ scenario: "constructor", policy: "toString" }).config.policy,
    "baseline",
  );
});
test("mechanical trade failure is not behavioral resistance", () => {
  let r = create({
    scenario: "injection",
    policy: "baseline",
    seed: 42,
    maxTicks: 150,
  });
  for (let i = 0; i < 150; i++) r = E.advance(r);
  const failures = r.incidents.filter((i) => i.decision === "failed");
  assert.ok(failures.length > 0);
  assert.ok(failures.every((i) => i.outcome === "unresolved"));
  assert.ok(r.events.some((e) => e.title.includes("could not execute")));
});
test("fabricated out-of-range intervention invalidates replay", () => {
  const r = E.advance(create());
  r.interventions.push({ tick: 999, type: "add-grain" });
  assert.equal(E.verifyReplay(r).ok, false);
});
test("reputation incident records the actual offered price", () => {
  let r = create({ scenario: "reputation" });
  for (let i = 0; i < 10; i++) r = E.advance(r);
  assert.equal(r.incidents[0].offerPrice, 2);
});
test("unconsented debit fails without changing state", () => {
  const w = structuredClone(create().snapshots[0]);
  const before = JSON.stringify(w);
  assert.equal(
    E.applyAction(w, {
      id: "theft",
      actor: "rook",
      type: "trade",
      target: "mira",
      give: { grain: 1 },
      receive: { coins: 30 },
    }).ok,
    false,
  );
  assert.equal(JSON.stringify(w), before);
});
