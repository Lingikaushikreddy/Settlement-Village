import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  command,
  advanceGame,
  restoreGame,
} from "../lib/game/economy.ts";
import {
  startBattle,
  deploy,
  stepBattle,
  settleBattle,
} from "../lib/game/battle.ts";
test("building placement charges once and refuses an occupied tile without mutation", () => {
  const g = newGame();
  const before = structuredClone(g);
  const n = command(g, { type: "build", kind: "farm", x: 1, y: 1 });
  assert.equal(n.buildings.length, g.buildings.length + 1);
  assert.ok(n.resources.wood < g.resources.wood);
  assert.deepEqual(g, before);
  assert.throws(
    () => command(n, { type: "build", kind: "farm", x: 1, y: 1 }),
    /occupied/i,
  );
  assert.throws(
    () => command(g, { type: "build", kind: "farm", x: -1, y: 1 }),
    /tile/i,
  );
});
test("production is collected once and upgrade completion uses the builder clock", () => {
  let g = newGame();
  const mine = g.buildings.find((b) => b.kind === "mine");
  const gold = g.resources.gold;
  g = command(g, { type: "collect", id: mine.id });
  assert.ok(g.resources.gold > gold);
  const amount = g.resources.gold;
  g = command(g, { type: "collect", id: mine.id });
  assert.equal(g.resources.gold, amount);
  g = command(g, { type: "upgrade", id: mine.id });
  assert.throws(
    () => command(g, { type: "upgrade", id: mine.id }),
    /progress/i,
  );
  g = advanceGame(g, 60);
  assert.equal(g.buildings.find((b) => b.id === mine.id).level, 2);
});
test("training spends resources on enqueue and produces units only when ready", () => {
  const g = newGame();
  let n = command(g, { type: "train", kind: "knight", count: 5 });
  assert.equal(n.army.knight, g.army.knight);
  assert.ok(n.resources.food < g.resources.food);
  n = advanceGame(n, 60);
  assert.equal(n.army.knight, g.army.knight + 5);
  assert.equal(n.training.length, 0);
  assert.throws(
    () => command(g, { type: "train", kind: "knight", count: 999 }),
    /count/i,
  );
});
test("offline advancement is capped and malformed saves are rejected", () => {
  const g = newGame();
  assert.deepEqual(advanceGame(g, 999999, false), advanceGame(g, 28800, false));
  assert.throws(() => restoreGame('{"version":2}'), /save/i);
  assert.equal(restoreGame(JSON.stringify(g)).version, 2);
});
test("deploying spends actual reserves and combat is deterministic", () => {
  let g = startBattle(newGame(), 0);
  const reserve = g.army.knight;
  g = deploy(g, "knight", "south", 3);
  assert.equal(g.army.knight, reserve - 3);
  assert.equal(g.battle.units.length, 3);
  assert.throws(() => deploy(g, "archer", "middle", 1), /zone/i);
  assert.deepEqual(stepBattle(g, 0.2), stepBattle(structuredClone(g), 0.2));
  let n = g;
  for (let i = 0; i < 600; i++) n = stepBattle(n, 0.2);
  assert.ok(n.battle.result);
  assert.ok(n.battle.elapsed <= 90.2);
});
test("raid rewards settle exactly once and undeployed reserves remain", () => {
  let g = startBattle(newGame(), 0);
  const reserves = { ...g.army };
  g.battle.buildings.forEach((b) => (b.hp = 0));
  g = stepBattle(g, 0.2);
  assert.equal(g.battle.result.stars, 3);
  const paid = settleBattle(g);
  assert.ok(paid.resources.gold > g.resources.gold);
  assert.deepEqual(paid.army, reserves);
  assert.deepEqual(settleBattle(paid), paid);
  assert.equal(paid.stats.wins, 1);
});
test("save import rejects invalid raid geometry and missing village progress", () => {
  let g = startBattle(newGame(), 0);
  g.battle.buildings[0].x = "broken";
  assert.throws(() => restoreGame(JSON.stringify(g)), /save/i);
  g = newGame();
  delete g.stats.wins;
  assert.throws(() => restoreGame(JSON.stringify(g)), /save/i);
});
test("two builders cannot spend resources on a third simultaneous project", () => {
  let g = command(newGame(), { type: "build", kind: "farm", x: 1, y: 1 });
  g = command(g, { type: "build", kind: "mine", x: 2, y: 1 });
  const before = structuredClone(g);
  assert.throws(
    () => command(g, { type: "build", kind: "tower", x: 3, y: 1 }),
    /builders/i,
  );
  assert.deepEqual(g, before);
});
