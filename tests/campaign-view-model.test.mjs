import test from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../lib/game/economy.ts";
import { councilRun, newCouncil } from "../lib/game/council.ts";
import {
  activeIncidentTargets,
  armyTotal,
  battleStars,
  buildingSummary,
  destructionPercent,
  displayedResearch,
  hudFigures,
  placementTitle,
  researchCaption,
  sceneResidents,
} from "../components/game/campaign-view-model.ts";

const game = newGame();

test("hudFigures reads the hall level, free builders and formatted resources", () => {
  const hud = hudFigures(game);
  assert.equal(hud.hallLevel, 1);
  assert.equal(hud.builders, "2/2");
  assert.deepEqual(
    hud.resources.map((r) => [r.key, r.label, r.amount, r.display]),
    [["gold", "Gold", 1250, "1,250"], ["wood", "Timber", 900, "900"], ["food", "Food", 750, "750"]],
  );
  assert.equal(armyTotal(game), 20);
});

test("battleStars and destructionPercent follow the three-star rule", () => {
  const hall = { id: "h", kind: "hall", x: 0, y: 0, hp: 0, maxHp: 10 };
  const tower = (hp) => ({ id: "t" + hp, kind: "tower", x: 1, y: 1, hp, maxHp: 10 });
  const battle = (buildings) => ({ level: 0, elapsed: 0, units: [], buildings, deployed: 0 });
  assert.equal(battleStars(battle([hall, tower(10), tower(10)])), 1); // hall down, 1/3 destroyed
  assert.equal(battleStars(battle([hall, tower(0), tower(10)])), 2); // hall down, 2/3 destroyed
  assert.equal(battleStars(battle([hall, tower(0), tower(0)])), 3);
  assert.equal(battleStars(battle([{ ...hall, hp: 5 }, tower(0), tower(10)])), 0); // 1/3 destroyed, hall standing
  assert.equal(destructionPercent(battle([hall, tower(0), tower(10)])), 66);
});

test("researchCaption names the three modes and defaults to the recorded replay", () => {
  assert.equal(researchCaption("worker"), "Worker experiment");
  assert.equal(researchCaption("local"), "Browser experiment");
  assert.equal(researchCaption("recorded"), "Recorded replay");
  assert.equal(researchCaption(undefined), "Recorded replay");
});

test("displayedResearch prefers the frame, then the research run, then the council run at its last tick", () => {
  const council = councilRun(game.council ?? newCouncil());
  const fallback = displayedResearch(null, null, game);
  assert.equal(fallback.run.id, council.id);
  assert.equal(fallback.tick, council.snapshots.length - 1);
  const research = displayedResearch(null, { run: council }, game);
  assert.equal(research.tick, council.snapshots.length - 1);
  const framed = displayedResearch({ run: council, tick: 0, selected: "mira", mode: "local" }, { run: council }, game);
  assert.equal(framed.tick, 0);
});

test("sceneResidents overlays crew roles only when the crew is visible and has an objective", () => {
  const run = councilRun(newCouncil());
  const tick = run.snapshots.length - 1;
  const plain = sceneResidents(run, tick, game, true);
  assert.deepEqual(plain, run.snapshots[tick].agents, "no objective: residents unchanged");
  assert.deepEqual(
    activeIncidentTargets(run, tick),
    run.incidents.filter((i) => i.tick <= tick && (i.resolvedTick === null || i.resolvedTick > tick)).map((i) => i.target),
  );
});

test("buildingSummary and placementTitle produce the panel strings", () => {
  const hall = game.buildings.find((b) => b.kind === "hall");
  assert.equal(buildingSummary(game, hall), "The heart of Willowmere. Upgrade to unlock stronger buildings.");
  const mine = game.buildings.find((b) => b.kind === "mine");
  assert.match(buildingSummary(game, mine), /gold \/ second · \d+ \/ \d+ stored$/);
  assert.match(buildingSummary(game, { ...mine, readyAt: game.clock + 12 }), /^Ready in 12 seconds$/);
  assert.equal(placementTitle(game, "new:tower"), "Place your watchtower");
  assert.equal(placementTitle(game, hall.id), "Choose a new location");
});
