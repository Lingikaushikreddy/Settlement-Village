import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { evaluateAgent, loadScenarioFile, BUILT_IN_IDS } from "../lib/testbed/index.ts";

const DIR = "examples/scenarios/research";
// Fields that must not differ between the attacks of one family, so a score difference is
// attributable to the framing alone.
const COMMON = ["kind", "proposer", "excludeTargets", "offer", "acceptMeans", "evidence", "contradiction", "harm", "goal", "resolvesOnDecision"];
const FAMILIES = {
  "persuasion-cues": {
    attacks: ["cue-neutral", "cue-authority", "cue-urgency", "cue-social-proof", "cue-reciprocity", "cue-commitment"],
    honest: "cue-honest",
    fixed: [...COMMON, "claimant"],
  },
};
const ALL = Object.values(FAMILIES).flatMap((f) => [...f.attacks, f.honest]);
const load = (id) => loadScenarioFile(`${DIR}/${id}.json`);

test("the pack directory holds exactly the declared scenarios (plus sources.json)", () => {
  const files = readdirSync(DIR).filter((f) => f !== "sources.json").sort();
  assert.deepEqual(files, ALL.map((id) => `${id}.json`).sort());
});

test("every scenario validates, matches its file name and avoids reserved ids", () => {
  for (const id of ALL) {
    const d = load(id);
    assert.equal(d.id, id);
    assert.ok(!BUILT_IN_IDS.includes(id), `${id} shadows a built-in`);
    assert.ok(!["reciprocity", "reciprocity-honest"].includes(id), `${id} shadows the example pair`);
  }
});

test("claims fit the limit, carry no template tokens and never reveal the setup", () => {
  for (const id of ALL) {
    const { claim } = load(id);
    assert.ok(claim.length <= 400, `${id} claim is ${claim.length} characters`);
    assert.ok(!claim.includes("{{"), `${id} claim has a template token`);
    assert.ok(!claim.toLowerCase().includes(id), `${id} claim names its own id`);
    assert.doesNotMatch(claim, /\b(attack|honest|control|scenario|test)\b/i, `${id} claim leaks the setup`);
  }
});

for (const [name, family] of Object.entries(FAMILIES)) {
  test(`${name}: attacks differ only in framing and each family has an honest twin`, () => {
    const attacks = family.attacks.map(load);
    for (const a of attacks) assert.equal(a.kind, "attack", a.id);
    const honest = load(family.honest);
    assert.equal(honest.kind, "honest");
    assert.equal(honest.resolvesOnDecision, true);
    assert.equal(honest.contradiction.type, "never");
    const [first, ...rest] = attacks;
    for (const other of rest) {
      for (const key of family.fixed) assert.deepEqual(other[key], first[key], `${other.id}.${key} differs from ${first.id}`);
    }
    assert.equal(new Set(attacks.map((a) => a.claim)).size, attacks.length, "claims are distinct");
  });
}

test("the built-in Check evidence policy refuses every attack and accepts every honest twin", async () => {
  const definitions = ALL.map(load);
  const refuse = async () => ({ status: "valid", action: "reject_claim", evidenceIds: [], summary: "no", latencyMs: 0 });
  // A run accepts at most 4 custom definitions (lib/testbed/run.ts), so evaluate in batches.
  const baselines = [];
  for (let i = 0; i < definitions.length; i += 4) {
    const { report } = await evaluateAgent({ source: refuse, name: "sanity", scenarios: definitions.slice(i, i + 4), seeds: [1, 2, 3] });
    baselines.push(...report.baselines);
  }
  for (const d of definitions) {
    const row = baselines.find((b) => b.scenario === d.id && b.policy === "evidence");
    assert.ok(row, `${d.id} has an evidence baseline`);
    if (d.kind === "attack") assert.equal(row.attackSuccessRate, 0, `${d.id}: evidence policy should resist`);
    else assert.equal(row.benignRefusalRate, 0, `${d.id}: evidence policy should accept`);
  }
});
