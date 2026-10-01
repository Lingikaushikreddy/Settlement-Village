import test from "node:test";
import assert from "node:assert/strict";
import { createRun, observe, runToEnd, scenarioInfo } from "../lib/sim/engine.ts";
import { crewRoster } from "../lib/game/crew.ts";

// Display names changed; ids stay stable so existing saves, art and replays keep working.
const NAMES = {
  mira: "Mira",
  theo: "Jhansi",
  ada: "Kavya",
  finn: "Sasi",
  lina: "Hitesh",
  oscar: "Anil",
  rook: "Rook",
};
const OLD_NAMES = /\b(Theo|Ada|Finn|Lina|Oscar)\b/;
const IDS_AS_NAMES = / (to|with) (mira|theo|ada|finn|lina|oscar)\b/;

test("research residents use the village names with unchanged ids", () => {
  const agents = createRun({ seed: 1 }).snapshots[0].agents;
  assert.deepEqual(Object.fromEntries(agents.map((a) => [a.id, a.name])), NAMES);
});

test("the campaign crew uses the same names", () => {
  for (const member of crewRoster) assert.equal(member.name, NAMES[member.id]);
});

test("claims, rules and event text never use old names or raw ids", () => {
  for (const scenario of Object.keys(scenarioInfo)) {
    const run = runToEnd({ scenario, policy: "evidence", seed: 1 });
    const text = JSON.stringify([
      scenarioInfo[scenario],
      observe(run, "mira").publicRules,
      run.events.map((e) => [e.title, e.detail]),
      run.decisions.map((d) => [d.selected, d.summary]),
    ]);
    assert.doesNotMatch(text, OLD_NAMES, scenario);
    assert.doesNotMatch(text, IDS_AS_NAMES, scenario);
  }
});
