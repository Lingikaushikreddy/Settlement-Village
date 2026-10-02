import test from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../lib/game/economy.ts";
import {
  actionProblem,
  buildProblem,
} from "../lib/game/action-availability.ts";

test("shop availability reports real spending and capacity constraints without changing the campaign", () => {
  const g = newGame();
  const before = structuredClone(g);
  assert.equal(
    actionProblem(g, { type: "train", kind: "knight", count: 1 }),
    null,
  );
  assert.equal(buildProblem(g, "farm"), null);
  assert.deepEqual(g, before);
  g.resources.gold = 0;
  assert.match(
    actionProblem(g, { type: "train", kind: "knight", count: 1 }),
    /gold/,
  );
  assert.match(buildProblem(g, "farm"), /gold/);
  g.resources.gold = 5000;
  g.army = { knight: 40, archer: 0, catapult: 0 };
  assert.match(
    actionProblem(g, { type: "train", kind: "knight", count: 1 }),
    /full/,
  );
});

test("building offers and upgrades disclose occupied builders and level dependencies", () => {
  const g = newGame();
  g.buildings[0].readyAt = 50;
  g.buildings[1].readyAt = 50;
  assert.match(buildProblem(g, "farm"), /builders/);
  const farm = g.buildings.find((b) => b.kind === "farm");
  farm.level = 2;
  assert.match(actionProblem(g, { type: "upgrade", id: farm.id }), /town hall/);
});
