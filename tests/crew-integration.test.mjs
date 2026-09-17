import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  advanceGame,
  restoreGame,
  command,
} from "../lib/game/economy.ts";
import { crewCommand } from "../lib/game/crew.ts";
import { startBattle } from "../lib/game/battle.ts";
test("live campaign ticks move the crew and execute actual orders", () => {
  let g = crewCommand(newGame(), { type: "start", kind: "raid" });
  const before = structuredClone(g);
  for (let i = 0; i < 20; i++) g = advanceGame(g, 0.2);
  assert.equal(g.crew.tick, 4);
  assert.ok(g.crew.agents.some((a) => a.task));
  assert.equal(before.crew.tick, 0);
});
test("save restore keeps objective and claims but pauses automatic spending", () => {
  let g = crewCommand(newGame(), { type: "start", kind: "raid" });
  for (let i = 0; i < 30; i++) g = advanceGame(g, 0.2);
  const saved = restoreGame(JSON.stringify(g));
  assert.ok(saved.crew);
  assert.equal(saved.crew.playing, false);
  assert.deepEqual(saved.crew.objective, g.crew.objective);
  assert.deepEqual(saved.crew.tasks, g.crew.tasks);
  assert.deepEqual(saved.resources, g.resources);
  const next = advanceGame(saved, 0.2);
  assert.equal(next.crew.tick, saved.crew.tick);
});
test("offline production and raids cannot execute crew orders", () => {
  const g = crewCommand(newGame(), { type: "start", kind: "raid" });
  const offline = advanceGame(g, 3600, false);
  assert.equal(offline.crew.tick, 0);
  assert.deepEqual(offline.resources, g.resources);
  const raid = advanceGame(startBattle(g, 0), 0.2);
  assert.equal(raid.crew.tick, 0);
});
test("restored crew resumes deterministically without collecting a store twice", () => {
  let g = crewCommand(newGame(), { type: "start", kind: "stockpile" });
  for (let i = 0; i < 90; i++) g = advanceGame(g, 0.2);
  let restored = crewCommand(restoreGame(JSON.stringify(g)), {
    type: "resume",
  });
  let uninterrupted = crewCommand(crewCommand(g, { type: "pause" }), {
    type: "resume",
  });
  for (let i = 0; i < 150; i++) {
    restored = advanceGame(restored, 0.2);
    uninterrupted = advanceGame(uninterrupted, 0.2);
  }
  assert.deepEqual(restored, uninterrupted);
});
test("invalid crew claims cannot enter an imported save", () => {
  const g = crewCommand(newGame(), { type: "start", kind: "raid" });
  g.crew.agents[0].task = "missing-job";
  assert.throws(() => restoreGame(JSON.stringify(g)), /damaged/i);
});
test("existing campaign saves still restore with unchanged progress", () => {
  const g = command(newGame(), { type: "collect", id: "mine" });
  const restored = restoreGame(JSON.stringify(g));
  assert.deepEqual(restored.resources, g.resources);
  assert.deepEqual(restored.army, g.army);
  assert.equal(restored.crew, undefined);
});
