import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseScenarioDefinition, BUILT_IN_SCENARIOS, BUILT_IN_IDS, createRegistry, expandFact } from "../lib/sim/scenarios/index.ts";
import { createRun } from "../lib/sim/engine.ts";

const base = () => JSON.parse(readFileSync("lib/sim/scenarios/scarcity.json", "utf8"));

test("the four built-in files validate and the registry serves them first", () => {
  assert.deepEqual(BUILT_IN_IDS, ["scarcity", "reputation", "injection", "benign"]);
  for (const id of BUILT_IN_IDS) assert.equal(BUILT_IN_SCENARIOS[id].id, id);
  const registry = createRegistry();
  assert.deepEqual(registry.ids(), [...BUILT_IN_IDS]);
  assert.equal(registry.get("scarcity").kind, "attack");
  assert.equal(registry.get("benign").kind, "honest");
  assert.deepEqual(registry.custom(), []);
});

test("a custom definition registers after the built-ins and cannot shadow one", () => {
  const custom = { ...base(), id: "urgency", name: "Urgency" };
  const registry = createRegistry([custom]);
  assert.deepEqual(registry.ids(), [...BUILT_IN_IDS, "urgency"]);
  assert.equal(registry.custom().length, 1);
  assert.throws(() => createRegistry([{ ...base(), name: "Shadow" }]), /shadows a built-in/);
  assert.throws(() => createRegistry([custom, { ...custom }]), /duplicate/);
});

test("the schema rejects what the engine cannot run", () => {
  const ok = parseScenarioDefinition(base());
  assert.equal(ok.id, "scarcity");
  assert.throws(() => parseScenarioDefinition({ ...base(), extra: 1 }), /Unrecognized key/);
  assert.throws(() => parseScenarioDefinition({ ...base(), id: "Bad Id" }));
  assert.throws(() => parseScenarioDefinition({ ...base(), proposer: "mira" }));
  assert.throws(() => parseScenarioDefinition({ ...base(), offer: { give: {}, receive: { coins: 2 } } }));
  assert.throws(() => parseScenarioDefinition({ ...base(), evidence: { site: "castle", fact: "x" } }));
  assert.throws(() => parseScenarioDefinition({ ...base(), evidence: { site: "market", fact: "{{stock:castle:grain}}" } }), /unknown location/);
  assert.throws(() => parseScenarioDefinition({ ...base(), contradiction: { type: "stock_above", location: "granary", resource: "gold", threshold: 1, honorsPublishedStock: false } }));
  const inverted = { ...base(), acceptMeans: "refuse_proposer" };
  assert.throws(() => parseScenarioDefinition(inverted), /actedOnAllegation/);
});

test("fact templates expand against the world at the time of inspection", () => {
  const run = createRun({ scenario: "scarcity", seed: 1, policy: "evidence", maxTicks: 20 });
  const world = run.snapshots[0];
  assert.equal(expandFact("Observed {{stock:granary:grain}} grain.", world), "Observed 80 grain.");
  assert.equal(expandFact("{{stock:market:grain}}", world), "0");
});
