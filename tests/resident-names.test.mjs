import test from "node:test";
import assert from "node:assert/strict";
import { createRun, observe, runToEnd, scenarioInfo } from "../lib/sim/engine.ts";
import { crewRoster } from "../lib/game/crew.ts";

// Ids stay stable and separate from display names, so saves, art and replays keep working.
const NAMES = {
  mira: "Mira",
  theo: "Theo",
  ada: "Ada",
  finn: "Finn",
  lina: "Lina",
  oscar: "Oscar",
  rook: "Rook",
};
// The short-lived rename to these names was reverted; they now belong to troops only.
const OLD_NAMES = /\b(Jhansi|Kavya|Sasi|Hitesh|Anil)\b/;
const IDS_AS_NAMES = / (to|with) (mira|theo|ada|finn|lina|oscar)\b/;

test("research residents use their original names with unchanged ids", () => {
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
