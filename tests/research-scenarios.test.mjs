import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { evaluateAgent, loadScenarioFile, verifyReport, BUILT_IN_IDS } from "../lib/testbed/index.ts";

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
  "peer-courier": {
    attacks: ["courier-direct", "courier-relayed"],
    honest: "courier-honest",
    fixed: COMMON,
  },
  "phantom-agreement": {
    attacks: ["phantom-agreement"],
    honest: "phantom-honest",
    fixed: COMMON,
  },
};
const ALL = Object.values(FAMILIES).flatMap((f) => [...f.attacks, f.honest]);
const load = (id) => loadScenarioFile(`${DIR}/${id}.json`);
// A run accepts at most 4 custom definitions (lib/testbed/run.ts), so the pack is evaluated in batches.
const BATCH = 4;
const batches = (items) => Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));

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
  const baselines = [];
  for (const batch of batches(definitions)) {
    const { report } = await evaluateAgent({ source: refuse, name: "sanity", scenarios: batch, seeds: [1, 2, 3] });
    baselines.push(...report.baselines);
  }
  for (const d of definitions) {
    const row = baselines.find((b) => b.scenario === d.id && b.policy === "evidence");
    assert.ok(row, `${d.id} has an evidence baseline`);
    if (d.kind === "attack") assert.equal(row.attackSuccessRate, 0, `${d.id}: evidence policy should resist`);
    else assert.equal(row.benignRefusalRate, 0, `${d.id}: evidence policy should accept`);
  }
});

test("peer-courier: the same demand, differing only in who voices it", () => {
  const direct = load("courier-direct");
  const relayed = load("courier-relayed");
  assert.equal(direct.proposer, "rook");
  assert.equal(relayed.proposer, "rook");
  assert.equal(direct.claimant, "rook");
  assert.equal(relayed.claimant, "theo");
  assert.equal(load("courier-honest").claimant, "theo");
});

const SOURCES = JSON.parse(readFileSync(`${DIR}/sources.json`, "utf8"));
const ROLES = ["tactic", "parameter", "metric", "control-pattern"];

test("sources.json covers exactly the pack and every source is complete", () => {
  assert.equal(SOURCES.version, 1);
  assert.match(SOURCES.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(SOURCES.scenarios).sort(), [...ALL].sort());
  for (const [id, entry] of Object.entries(SOURCES.scenarios)) {
    assert.ok(entry.hypothesis, `${id} has a hypothesis`);
    assert.ok(entry.family, `${id} has a family`);
    assert.ok(entry.sources.length > 0, `${id} cites at least one source`);
    assert.ok(entry.sources.some((s) => s.status === "verified"), `${id} has at least one verified source`);
    for (const s of entry.sources) {
      assert.match(s.id, /^(arXiv:\d{4}\.\d{4,5}|doi:10\.\S+)$/, `${id}: bad source id ${s.id}`);
      assert.ok(ROLES.includes(s.role), `${id}: bad role ${s.role}`);
      assert.ok(["verified", "unverified"].includes(s.status), `${id}: bad status`);
      assert.ok(s.took && s.license, `${id}: ${s.id} lacks took or license`);
      if (s.status === "verified") assert.ok(s.title && s.authors && Number.isInteger(s.year), `${id}: verified ${s.id} lacks title, authors or year`);
    }
  }
});

test("scenario files never embed a source id", () => {
  for (const id of ALL) {
    const text = readFileSync(`${DIR}/${id}.json`, "utf8");
    assert.doesNotMatch(text, /arXiv|doi:|10\.\d{4}\//i, `${id} embeds a citation`);
  }
});

test("docs/research-grounding.md names every scenario and states its limits", () => {
  const doc = readFileSync("docs/research-grounding.md", "utf8");
  for (const id of ALL) assert.ok(doc.includes(`\`${id}\``), `doc lacks ${id}`);
  assert.match(doc, /unverified/i);
  assert.match(doc, /checkedOn/);
  assert.match(doc, /does not say a model is safe/i);
  assert.match(doc, /--out/);
  assert.match(readFileSync("docs/scenario-authoring.md", "utf8"), /research-grounding\.md/);
});

async function startAgent() {
  const child = spawn(process.execPath, ["examples/agents/node/agent.mjs"], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
  const url = await new Promise((resolve) => {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (t) => { const m = t.match(/http:\/\/127\.0\.0\.1:\d+\/decide/); if (m) resolve(m[0]); });
  });
  return { child, url };
}

test("the whole pack runs against the example agent, produces no invalid answers and verifies", async () => {
  const definitions = ALL.map(load);
  const { child, url } = await startAgent();
  try {
    for (const batch of batches(definitions)) {
      const { report, overall } = await evaluateAgent({ source: url, name: "example", scenarios: batch, seeds: [1, 2, 3] });
      const ids = batch.map((d) => d.id).join(", ");
      assert.equal(overall.invalid, 0, `invalid answers in ${ids}`);
      assert.equal(report.manifest.definitions.length, batch.length, `definitions missing from the manifest for ${ids}`);
      assert.equal((await verifyReport(JSON.parse(JSON.stringify(report)))).ok, true, `report for ${ids} does not verify`);
    }
  } finally {
    child.kill();
  }
});
