import test from "node:test";
import assert from "node:assert/strict";
import { newGame, advanceGame } from "../lib/game/economy.ts";
import { troops, troopCount } from "../lib/game/catalog.ts";
import { crewCommand, advanceCrew, crewRoster } from "../lib/game/crew.ts";

// Display names changed; the ids "knight" and "archer" stay stable so saves keep loading.
test("knights are called Kavya and archers are called Jhansi", () => {
  assert.equal(troops.knight.name, "Kavya");
  assert.equal(troops.archer.name, "Jhansi");
  assert.equal(troops.catapult.name, "Catapult");
});

test("troop counts read naturally inside sentences", () => {
  assert.equal(troopCount("knight", 1), "1 Kavya");
  assert.equal(troopCount("knight", 5), "5 Kavyas");
  assert.equal(troopCount("archer", 1), "1 Jhansi");
  assert.equal(troopCount("archer", 4), "4 Jhansis");
  assert.equal(troopCount("catapult", 1), "1 catapult");
  assert.equal(troopCount("catapult", 3), "3 catapults");
});

test("raid labels, memories and events use the new troop names", () => {
  let g = crewCommand(newGame(), { type: "start", kind: "raid" });
  const seen = [];
  for (let i = 0; i < 300; i++) {
    g = advanceCrew(advanceGame(g, 1, false), 1);
    seen.push(...g.crew.tasks.map((t) => t.label));
    seen.push(...g.crew.events.map((e) => e.text));
    for (const a of g.crew.agents) seen.push(...a.memories.map((m) => m.text));
  }
  const text = [...new Set(seen), ...crewRoster.map((m) => m.specialty)].join("\n");
  assert.match(text, /\d+ Kavyas?\b/);
  assert.match(text, /\d+ Jhansis?\b/);
  assert.doesNotMatch(text, /\b(knights?|archers?|kavyas?|jhansis?)\b/);
  assert.doesNotMatch(text, /\b(Knights?|Archers?)\b/);
});
