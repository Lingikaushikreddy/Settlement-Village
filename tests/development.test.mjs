import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  advanceGame,
  restoreGame,
  command,
} from "../lib/game/economy.ts";
import {
  crewCommand,
  crewPreview,
  crewProgress,
  advanceCrew,
} from "../lib/game/crew.ts";
import { crewSchema } from "../lib/game/crew-types.ts";
const start = (g = newGame()) =>
  crewCommand(g, { type: "start", kind: "develop" });
const tick = (g, count = 1) => {
  for (let i = 0; i < count; i++) g = advanceCrew(advanceGame(g, 1, false), 1);
  return g;
};
const keys = ["gold", "wood", "food"];

test("development preview authorizes an additional level-three farm with hall dependency", () => {
  const preview = crewPreview(newGame(), "develop");
  assert.deepEqual(preview.budget, { gold: 1560, wood: 1240, food: 0 });
  assert.deepEqual(preview.reserves, { gold: 250, wood: 200, food: 150 });
  assert.deepEqual(
    preview.development.steps.map((s) => s.id),
    ["hall-2", "farm-build", "farm-2", "farm-3"],
  );
  assert.deepEqual(preview.development.steps.at(-1).dependsOn, [
    "farm-2",
    "hall-2",
  ]);
});

test("residents complete real construction and upgrades without duplicating building IDs", () => {
  let g = start();
  const initialSerial = g.serial;
  for (let i = 0; i < 600 && g.crew.status !== "complete"; i++) {
    g = tick(g);
    assert.ok(g.buildings.filter((b) => b.readyAt !== undefined).length <= 2);
    assert.equal(
      new Set(g.buildings.map((b) => b.id)).size,
      g.buildings.length,
    );
    assert.ok(crewSchema.safeParse(g.crew).success);
    for (const r of keys)
      assert.ok(g.crew.objective.spent[r] <= g.crew.objective.budget[r]);
  }
  assert.equal(g.crew.status, "complete");
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 2);
  assert.equal(
    g.buildings.find((b) => b.id === g.crew.objective.development.farmId).level,
    3,
  );
  assert.equal(g.buildings.find((b) => b.kind === "hall").level, 2);
  assert.equal(g.serial, initialSerial + 1);
  assert.deepEqual(g.crew.objective.spent, { gold: 1560, wood: 1240, food: 0 });
  assert.equal(crewProgress(g).percent, 100);
  assert.equal(crewProgress(g).development.completed, 4);
});

test("construction execution preserves the reserve floor after every payment", () => {
  let g = start();
  let priorSpent = 0;
  for (let i = 0; i < 600; i++) {
    g = tick(g);
    const spent = keys.reduce((n, r) => n + g.crew.objective.spent[r], 0);
    if (spent > priorSpent)
      for (const r of keys)
        assert.ok(g.resources[r] >= g.crew.objective.reserves[r]);
    priorSpent = spent;
  }
  assert.equal(g.crew.status, "complete");
  assert.ok(priorSpent > 0);
});

test("depleted village collects resources and waits for actual construction completion", () => {
  let g = newGame();
  g.resources = { gold: 0, wood: 0, food: 0 };
  g.buildings.forEach((b) => {
    b.stored = 0;
  });
  g = start(g);
  let sawBuilding = false;
  for (let i = 0; i < 1100 && g.crew.status !== "complete"; i++) {
    g = tick(g);
    if (g.buildings.some((b) => b.readyAt !== undefined)) {
      sawBuilding = true;
      assert.equal(g.crew.status, "active");
    }
  }
  assert.ok(sawBuilding);
  assert.equal(g.crew.status, "complete");
});

test("manual additional farm satisfies construction and is not paid for twice", () => {
  let g = start();
  g = command(g, { type: "build", kind: "farm", x: 8, y: 8 });
  const manualId = g.buildings.at(-1).id;
  g = tick(g, 600);
  assert.equal(g.crew.status, "complete");
  assert.equal(g.crew.objective.development.farmId, manualId);
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 2);
  assert.deepEqual(g.crew.objective.spent, { gold: 1440, wood: 1120, food: 0 });
});

test("occupied construction site is reconsidered before spending", () => {
  let g = tick(start());
  const task = g.crew.tasks.find((t) => t.kind === "build");
  assert.ok(task);
  g = command(g, { type: "move", id: "tower", x: task.x, y: task.y });
  g = tick(g, 600);
  assert.equal(g.crew.status, "complete");
  assert.equal(
    new Set(g.buildings.map((b) => `${b.x},${b.y}`)).size,
    g.buildings.length,
  );
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 2);
});

test("save restore retains development decisions and resumes deterministically", () => {
  const g = tick(start(), 35);
  const restored = restoreGame(JSON.stringify(g));
  assert.equal(restored.crew.playing, false);
  assert.deepEqual(restored.crew.objective, g.crew.objective);
  const resumed = crewCommand(restored, { type: "resume" });
  const uninterrupted = crewCommand(crewCommand(g, { type: "pause" }), {
    type: "resume",
  });
  assert.deepEqual(tick(resumed, 500), tick(uninterrupted, 500));
});

test("development plan validation rejects absent plans and invalid dependencies", () => {
  const g = start();
  assert.ok(g.crew.objective.development);
  const missing = structuredClone(g);
  delete missing.crew.objective.development;
  assert.throws(() => restoreGame(JSON.stringify(missing)), /damaged/);
  const cycle = structuredClone(g);
  cycle.crew.objective.development.steps[0].dependsOn = ["farm-3"];
  assert.throws(() => restoreGame(JSON.stringify(cycle)), /damaged/);
});

test("already funded Town hall upgrade is a zero-cost prerequisite", () => {
  let g = command(newGame(), { type: "upgrade", id: "hall" });
  const preview = crewPreview(g, "develop");
  assert.deepEqual(preview.budget, { gold: 600, wood: 600, food: 0 });
  assert.deepEqual(preview.development.steps[0].cost, {
    gold: 0,
    wood: 0,
    food: 0,
  });
  g = tick(start(g), 600);
  assert.equal(g.crew.status, "complete");
  assert.deepEqual(g.crew.objective.spent, { gold: 600, wood: 600, food: 0 });
});

test("busy builders hold development spending until a slot becomes available", () => {
  let g = newGame();
  g.resources = { gold: 10000, wood: 10000, food: 10000 };
  g = command(command(g, { type: "upgrade", id: "mine" }), {
    type: "upgrade",
    id: "mill",
  });
  g = start(g);
  for (let i = 0; i < 40; i++) g = advanceCrew(g, 1);
  assert.deepEqual(g.crew.objective.spent, { gold: 0, wood: 0, food: 0 });
  assert.ok(g.crew.tasks.some((t) => /builders/.test(t.blocked ?? "")));
  g = tick(g, 300);
  assert.equal(g.crew.status, "complete");
});

test("sealed-off residents cannot place a farm or spend outside a walkable route", () => {
  let g = start();
  g.resources = { gold: 10000, wood: 10000, food: 10000 };
  g.crew.agents.forEach((a) => {
    a.x = 0;
    a.y = 0;
  });
  g.buildings.push(
    { id: "wall-a", kind: "tower", x: 1, y: 0, level: 1, stored: 0 },
    { id: "wall-b", kind: "tower", x: 0, y: 1, level: 1, stored: 0 },
  );
  g = tick(g, 100);
  assert.deepEqual(g.crew.objective.spent, { gold: 0, wood: 0, food: 0 });
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 1);
  assert.ok(
    g.crew.tasks.some((t) =>
      /reachable construction site/.test(t.blocked ?? ""),
    ),
  );
  assert.ok(g.crew.events.length < 30);
  assert.ok(crewSchema.safeParse(g.crew).success);
  const restored = restoreGame(JSON.stringify(g));
  assert.deepEqual(restored.crew.tasks, g.crew.tasks);
});

test("manual upgrades satisfy the plan without replaying their payments", () => {
  let g = start();
  g.resources = { gold: 10000, wood: 10000, food: 10000 };
  g = command(g, { type: "upgrade", id: "hall" });
  g = command(g, { type: "build", kind: "farm", x: 8, y: 8 });
  const farmId = g.buildings.at(-1).id;
  g = advanceGame(g, 40, false);
  g = command(g, { type: "upgrade", id: farmId });
  g = advanceGame(g, 16, false);
  g = command(g, { type: "upgrade", id: farmId });
  g = tick(g, 100);
  assert.equal(g.crew.status, "complete");
  assert.deepEqual(g.crew.objective.spent, { gold: 0, wood: 0, food: 0 });
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 2);
});

test("exhausted saved authorization never permits an extra construction payment", () => {
  let g = start();
  g.resources = { gold: 10000, wood: 10000, food: 10000 };
  g.crew.objective.spent = { ...g.crew.objective.budget };
  g = tick(g, 100);
  assert.equal(g.buildings.filter((b) => b.kind === "farm").length, 1);
  assert.equal(g.buildings.find((b) => b.id === "hall").level, 1);
  assert.ok(g.crew.tasks.some((t) => /budget reached/.test(t.blocked ?? "")));
});

test("rest and cancellation release construction work without future purchases", () => {
  let g = tick(start());
  const resident = g.crew.agents.find((a) =>
    g.crew.tasks.some((t) => t.kind === "build" && t.assignee === a.id),
  );
  assert.ok(resident);
  const task = resident.task;
  g = crewCommand(g, { type: "rest", id: resident.id });
  g = tick(g);
  assert.notEqual(
    g.crew.tasks.find((t) => t.id === task)?.assignee,
    resident.id,
  );
  g = crewCommand(g, { type: "cancel" });
  const before = structuredClone(g);
  assert.deepEqual(advanceCrew(g, 1), before);
  assert.equal(g.crew.tasks.length, 0);
});

test("completed prerequisites remain complete while the next farm upgrade is running", () => {
  let g = start();
  g.resources = { gold: 10000, wood: 10000, food: 10000 };
  let checked = false;
  for (let i = 0; i < 200; i++) {
    g = tick(g);
    const farm = g.buildings.find(
      (b) => b.id === g.crew.objective.development.farmId,
    );
    if (farm?.readyAt !== undefined && !farm.constructing) {
      const steps = crewProgress(g).development.steps;
      assert.equal(steps.find((s) => s.id === "farm-build").status, "complete");
      if (farm.level === 2)
        assert.equal(steps.find((s) => s.id === "farm-2").status, "complete");
      checked = true;
    }
  }
  assert.ok(checked);
});
