import test from "node:test";
import assert from "node:assert/strict";
import { newGame, advanceGame } from "../lib/game/economy.ts";
import { command } from "../lib/game/commands.ts";
import {
  newCrew,
  crewCommand,
  advanceCrew,
  crewPreview,
  crewProgress,
} from "../lib/game/crew.ts";
import { crewSchema } from "../lib/game/crew-types.ts";
const start = (kind = "raid") =>
  crewCommand(newGame(), { type: "start", kind });
const tick = (g, n = 1) => {
  for (let i = 0; i < n; i++) g = advanceCrew(advanceGame(g, 1, false), 1);
  return g;
};
const total = (g) =>
  Object.values(g.army).reduce((a, b) => a + b, 0) + g.training.length;
test("raid plan has an exact bounded recruitment budget and completion waits for ready troops", () => {
  let g = start();
  assert.deepEqual(crewPreview(newGame(), "raid").budget, {
    gold: 250,
    wood: 60,
    food: 300,
  });
  assert.equal(g.council.playing, false);
  g = tick(g, 300);
  assert.equal(g.crew.status, "complete");
  assert.equal(total(g), 30);
  assert.equal(g.training.length, 0);
  assert.deepEqual(g.army, { knight: 14, archer: 12, catapult: 4 });
  assert.deepEqual(g.crew.objective.spent, { gold: 250, wood: 60, food: 300 });
  assert.equal(crewProgress(g).percent, 100);
  assert.deepEqual(advanceCrew(g, 1), g);
});
test("stockpile collects real stores, conserving resources and using no objective rewards", () => {
  let g = start("stockpile");
  const before = structuredClone(g);
  for (let i = 0; i < 30; i++) g = advanceCrew(g, 1);
  for (const r of ["gold", "wood", "food"]) {
    const kinds = { gold: "mine", wood: "mill", food: "farm" };
    assert.equal(
      g.resources[r] + g.buildings.find((b) => b.kind === kinds[r]).stored,
      before.resources[r] +
        before.buildings.find((b) => b.kind === kinds[r]).stored,
    );
  }
  assert.equal(g.training.length, 0);
  g = tick(g, 180);
  assert.equal(g.crew.status, "complete");
  assert.deepEqual(g.crew.objective.spent, { gold: 0, wood: 0, food: 0 });
});
test("depleted village creates collection demand and eventually prepares a raid", () => {
  let g = newGame();
  g.resources = { gold: 0, wood: 0, food: 0 };
  g.buildings.forEach((b) => (b.stored = 0));
  g = crewCommand(g, { type: "start", kind: "raid" });
  g = tick(g, 650);
  assert.equal(g.crew.status, "complete");
  assert.equal(total(g), 30);
});
test("claims are exclusive and rest releases work for another resident", () => {
  let g = tick(start("stockpile"));
  const a = g.crew.agents.find((a) => a.task);
  assert.ok(a);
  const task = a.task;
  g = crewCommand(g, { type: "rest", id: a.id });
  assert.equal(g.crew.agents.find((x) => x.id === a.id).task, null);
  g = tick(g);
  assert.notEqual(g.crew.tasks.find((t) => t.id === task)?.assignee, a.id);
  for (let i = 0; i < 30; i++) {
    g = tick(g);
    assert.ok(crewSchema.safeParse(g.crew).success);
  }
});
test("manual recruitment prevents duplicate jobs and never expands the initial budget", () => {
  let g = start();
  g = command(g, { type: "train", kind: "knight", count: 5 });
  g = tick(g, 300);
  assert.equal(total(g), 30);
  for (const r of ["gold", "wood", "food"])
    assert.ok(g.crew.objective.spent[r] <= g.crew.objective.budget[r]);
});
test("crew isolation freezes paused, offline, council and raid execution", () => {
  const g = start();
  for (const seconds of [2, 60, 0, -1, NaN])
    assert.deepEqual(advanceCrew(g, seconds), g);
  const paused = crewCommand(g, { type: "pause" });
  assert.deepEqual(advanceCrew(paused, 1), paused);
  const council = structuredClone(g);
  council.council.playing = true;
  assert.deepEqual(advanceCrew(council, 1), council);
  const battle = { ...g, battle: { result: undefined } };
  assert.deepEqual(advanceCrew(battle, 1), battle);
  assert.equal(advanceCrew(advanceCrew(g, 0.5), 0.5).crew.tick, 1);
});
test("save validation rejects duplicated residents, mismatched claims and overspending", () => {
  const c = tick(start()).crew;
  assert.ok(crewSchema.safeParse(c).success);
  const duplicate = structuredClone(c);
  duplicate.agents[1].id = duplicate.agents[0].id;
  assert.equal(crewSchema.safeParse(duplicate).success, false);
  const invalid = structuredClone(c);
  invalid.agents[0].task = "missing";
  assert.equal(crewSchema.safeParse(invalid).success, false);
  const over = structuredClone(c);
  over.objective.spent.gold = over.objective.budget.gold + 1;
  assert.equal(crewSchema.safeParse(over).success, false);
});
test("deterministic serialized resume preserves decisions and bounded memories", () => {
  const g = tick(start(), 25);
  assert.deepEqual(tick(g, 100), tick(JSON.parse(JSON.stringify(g)), 100));
  assert.equal(newCrew(newGame()).agents.length, 6);
});
test("moving a workplace reroutes residents without walking through buildings", () => {
  let g = start("stockpile");
  g = tick(g);
  const mine = g.buildings.find((b) => b.id === "mine");
  g = command(g, { type: "move", id: mine.id, x: 8, y: 8 });
  const initial = g.resources.gold;
  for (let i = 0; i < 30; i++) {
    const old = g;
    g = advanceCrew(g, 1);
    for (const a of g.crew.agents) {
      const previous = old.crew.agents.find((p) => p.id === a.id);
      assert.ok(Math.abs(previous.x - a.x) + Math.abs(previous.y - a.y) <= 1);
      assert.ok(!g.buildings.some((b) => b.x === a.x && b.y === a.y));
    }
  }
  assert.ok(g.resources.gold > initial);
  assert.ok(g.crew.events.some((e) => /moved/.test(e.text)));
});
test("unreachable and constructing workplaces never collect or spend and do not spam logs", () => {
  let g = newGame();
  g.buildings.find((b) => b.id === "mine").x = 0;
  g.buildings.find((b) => b.id === "mine").y = 0;
  g.buildings.push(
    { id: "wall1", kind: "tower", x: 0, y: 1, level: 1, stored: 0 },
    { id: "wall2", kind: "tower", x: 1, y: 0, level: 1, stored: 0 },
  );
  g.buildings.find((b) => b.id === "barracks").readyAt = 1000;
  g = crewCommand(g, { type: "start", kind: "raid" });
  g.resources.gold = 0;
  const before = structuredClone(g);
  for (let i = 0; i < 50; i++) g = advanceCrew(g, 1);
  assert.equal(g.resources.gold, 0);
  assert.equal(g.training.length, 0);
  assert.equal(
    g.buildings.find((b) => b.id === "mine").stored,
    before.buildings.find((b) => b.id === "mine").stored,
  );
  assert.match(
    g.crew.tasks.find((t) => t.buildingId === "mine").blocked,
    /route/,
  );
  assert.match(
    g.crew.tasks.find((t) => t.kind === "train").blocked,
    /construction/,
  );
  assert.ok(g.crew.events.length < 30);
});
test("spent recruitment budget cannot be reused after manually removing trained troops", () => {
  let g = newGame();
  g.resources.gold = 0;
  g.buildings.find((b) => b.id === "mine").stored = 0;
  g = tick(crewCommand(g, { type: "start", kind: "raid" }), 150);
  assert.equal(g.crew.status, "active");
  const spent = { ...g.crew.objective.spent };
  g.army = { knight: 0, archer: 0, catapult: 0 };
  g.training = [];
  g = tick(g, 300);
  assert.deepEqual(g.crew.objective.spent, spent);
  assert.equal(total(g), 0);
  assert.ok(g.crew.tasks.some((t) => /budget/.test(t.blocked ?? "")));
});
test("cancel clears claims and no future crew tick changes the village", () => {
  let g = tick(start(), 2);
  g = crewCommand(g, { type: "cancel" });
  assert.equal(g.crew.status, "idle");
  assert.equal(g.crew.tasks.length, 0);
  assert.ok(g.crew.agents.every((a) => a.task === null));
  assert.deepEqual(advanceCrew(g, 1), g);
  assert.ok(crewSchema.safeParse(g.crew).success);
});
test("finished raid screens still block crew work until returning to the village", () => {
  const g = start();
  g.battle = { result: { stars: 1 } };
  assert.deepEqual(advanceCrew(g, 1), g);
  assert.throws(
    () => crewCommand(g, { type: "start", kind: "stockpile" }),
    /raid/i,
  );
  const paused = crewCommand(g, { type: "pause" });
  assert.equal(crewCommand(paused, { type: "resume" }).crew.playing, false);
});
test("many commands in one tick retain a bounded log with unique event IDs", () => {
  let g = start();
  for (let i = 0; i < 150; i++)
    g = crewCommand(g, { type: "rest", id: "mira" });
  assert.equal(g.crew.events.length, 120);
  assert.ok(crewSchema.safeParse(g.crew).success);
});
test("recruitment uses a reachable completed barracks when the first is enclosed", () => {
  let g = newGame();
  g.resources = { gold: 5000, wood: 5000, food: 5000 };
  const original = g.buildings.find((b) => b.id === "barracks");
  original.x = 0;
  original.y = 0;
  g.buildings.push(
    { id: "wall1", kind: "tower", x: 0, y: 1, level: 1, stored: 0 },
    { id: "wall2", kind: "tower", x: 1, y: 0, level: 1, stored: 0 },
    { id: "second-barracks", kind: "barracks", x: 7, y: 7, level: 1, stored: 0 },
  );
  g = crewCommand(g, { type: "start", kind: "raid" });
  g = tick(g, 200);
  assert.equal(g.crew.status, "complete");
  assert.deepEqual(g.army, { knight: 14, archer: 12, catapult: 4 });
  assert.equal(g.training.length, 0);
  assert.deepEqual(g.resources, { gold: 4750, wood: 4940, food: 4700 });
});
