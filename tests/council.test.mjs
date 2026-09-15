import test from "node:test";
import assert from "node:assert/strict";
import { newGame, advanceGame, restoreGame } from "../lib/game/economy.ts";
import { startBattle } from "../lib/game/battle.ts";
import { verifyReplay } from "../lib/sim/engine.ts";
import {
  councilCommand,
  councilRun,
  compareCouncil,
  residentView,
} from "../lib/game/council.ts";

function tick(g, count = 1) {
  for (let i = 0; i < count; i++) g = councilCommand(g, { type: "step" });
  return g;
}

test("old saves gain a paused council without changing buildings, resources, or battle progress", () => {
  const old = startBattle(newGame(), 0);
  delete old.council;
  const restored = restoreGame(JSON.stringify(old));
  assert.deepEqual(restored.resources, old.resources);
  assert.deepEqual(restored.buildings, old.buildings);
  assert.deepEqual(restored.battle, old.battle);
  assert.equal(restored.council.tick, 0);
  assert.equal(restored.council.playing, false);
});

test("real resident work pays once and reload never reissues the dividend", () => {
  let g = tick(newGame());
  // At tick 1 Mira gathers two grain, Finn two water, and Lina two wood.
  assert.deepEqual(g.resources, { gold: 1254, food: 758, wood: 908 });
  assert.equal(g.council.ledger.length, 3);
  const restored = restoreGame(JSON.stringify(g));
  assert.deepEqual(restored.resources, g.resources);
  assert.deepEqual(restored.council.ledger, g.council.ledger);
  assert.equal(verifyReplay(councilRun(restored.council)).ok, true);
  const offline = advanceGame(restored, 3600, false);
  assert.equal(offline.council.tick, 1);
  assert.deepEqual(offline.resources, g.resources);
});

test("construction affects resident yields and missing ready workplaces pay no dividend", () => {
  let g = newGame();
  g.buildings.find((b) => b.kind === "farm").level = 2;
  g.buildings.find((b) => b.kind === "mill").readyAt = 100;
  g = tick(g);
  assert.equal(g.resources.food, 766);
  assert.equal(g.resources.wood, 900);
});

test("a delivered rumor pauses before a resident acts; raids and offline time cannot advance it", () => {
  let g = councilCommand(newGame(), { type: "play" });
  for (let i = 0; i < 100; i++) g = advanceGame(g, 0.2);
  assert.equal(g.council.tick, 8);
  assert.equal(g.council.playing, false);
  assert.equal(councilRun(g.council).incidents[0].decision, "pending");
  g = councilCommand(g, { type: "play" });
  g = startBattle(g, 0);
  const c = structuredClone(g.council);
  g = advanceGame(g, 200);
  assert.deepEqual(g.council, c);
  assert.throws(() => councilCommand(g, { type: "step" }), /raid/i);
});

test("orders pay and affect the exact same simulation tick; insufficient funds do nothing", () => {
  let g = tick(newGame(), 8);
  const gold = g.resources.gold;
  g = councilCommand(g, { type: "intervene", action: "publish-stock" });
  assert.equal(g.council.tick, 9);
  assert.equal(councilRun(g.council).snapshots[9].verifiedStock, true);
  assert.ok(
    g.council.ledger.some(
      (e) => e.kind === "order" && e.delta.gold === -20 && e.tick === 9,
    ),
  );
  assert.ok(g.resources.gold <= gold - 20 + 4);
  assert.equal(verifyReplay(councilRun(g.council)).ok, true);
  assert.throws(
    () => councilCommand(g, { type: "intervene", action: "publish-stock" }),
    /already/i,
  );
  g.resources.food = 59;
  const before = structuredClone(g);
  assert.throws(
    () => councilCommand(g, { type: "intervene", action: "add-grain" }),
    /food/i,
  );
  assert.deepEqual(g, before);
});

test("successful deception costs actual treasury gold once and is traceable to its incident", () => {
  let g = tick(newGame(), 32);
  const run = councilRun(g.council);
  const harm = run.incidents.reduce((n, i) => n + i.harm, 0);
  assert.ok(harm > 0);
  const losses = g.council.ledger.filter((e) => e.kind === "harm");
  assert.equal(
    losses.reduce((n, e) => n - e.delta.gold, 0),
    harm * 20,
  );
  assert.ok(losses.every((e) => run.incidents.some((i) => i.id === e.source)));
  assert.deepEqual(
    g.resources,
    g.council.ledger.reduce(
      (r, e) => ({
        gold: r.gold + e.delta.gold,
        wood: r.wood + e.delta.wood,
        food: r.food + e.delta.food,
      }),
      { gold: 1250, wood: 900, food: 750 },
    ),
  );
  assert.throws(() => tick(g), /complete/i);
  assert.deepEqual(restoreGame(JSON.stringify(g)).resources, g.resources);
});

test("historical resident inspection cannot expose future or someone else's private evidence", () => {
  const g = tick(newGame(), 32);
  const run = councilRun(g.council);
  const view = residentView(run, "mira", 8);
  assert.ok(
    view.events.every(
      (e) =>
        e.tick <= 8 &&
        (e.visibility === "public" || e.audience.includes("mira")),
    ),
  );
  assert.ok(view.memories.every((m) => m.owner === "mira" && m.tick <= 8));
  assert.ok(!view.decision || view.decision.tick <= 8);
  assert.equal(residentView(run, "mira", 0).decision, undefined);
});

test("policy comparisons are matched, read only, and never pay live rewards", () => {
  const g = tick(newGame(), 8);
  const before = structuredClone(g);
  const compared = compareCouncil(g.council);
  assert.equal(compared.length, 3);
  assert.deepEqual(g, before);
  assert.equal(new Set(compared.map((c) => c.run.config.seed)).size, 1);
  assert.ok(
    compared.every(
      (c) =>
        c.run.status === "completed" &&
        c.run.interventions.length === 0 &&
        verifyReplay(c.run).ok,
    ),
  );
});

test("chapters progress once, retain village economy, and freeze policy after the first tick", () => {
  let g = newGame();
  g = councilCommand(g, { type: "policy", policy: "evidence" });
  g = tick(g);
  assert.throws(
    () => councilCommand(g, { type: "policy", policy: "baseline" }),
    /started/i,
  );
  assert.throws(() => councilCommand(g, { type: "next" }), /finish/i);
  g = tick(g, 31);
  const balance = { ...g.resources };
  g = councilCommand(g, { type: "next" });
  assert.equal(g.council.chapter, 1);
  assert.equal(g.council.tick, 0);
  assert.equal(g.council.history.length, 1);
  assert.deepEqual(g.resources, balance);
  assert.equal(councilRun(g.council).config.scenario, "reputation");
});

test("malformed council imports fail instead of resetting progress or silently replaying rewards", () => {
  let g = tick(newGame(), 8);
  g.council.tick = 9999;
  assert.throws(() => restoreGame(JSON.stringify(g)), /save/i);
  g = tick(newGame(), 8);
  g.council.interventions = [{ tick: 9, type: "publish-stock" }];
  assert.throws(() => restoreGame(JSON.stringify(g)), /save/i);
  g = tick(newGame(), 8);
  g.council.ledger[0].delta.gold = -999999;
  assert.throws(() => restoreGame(JSON.stringify(g)), /save/i);
});

test("an honest trade in the reputation chapter earns the same market dividend as other fair offers", () => {
  let g = tick(newGame(), 32);
  g = councilCommand(g, { type: "next" });
  g = councilCommand(g, { type: "policy", policy: "evidence" });
  g = tick(g, 32);
  const trades = councilRun(g.council).events.filter(
    (e) => e.type === "trade" && e.incidentId,
  );
  assert.equal(trades.length, 2);
  for (const trade of trades) {
    const receipt = g.council.ledger.find(
      (e) => e.chapter === 1 && e.source === trade.id && e.kind === "trade",
    );
    assert.equal(receipt?.delta.gold, 6);
  }
});

test("a resident who already decided is not shown as waiting for investigation", async () => {
  const { councilPending } = await import("../lib/game/council.ts");
  let g = tick(newGame(), 8);
  assert.equal(councilPending(councilRun(g.council)).length, 1);
  g = councilCommand(g, { type: "intervene", action: "publish-stock" });
  assert.equal(councilRun(g.council).incidents[0].decision, "refused");
  assert.equal(councilPending(councilRun(g.council)).length, 0);
});
