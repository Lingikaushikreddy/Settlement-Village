import { newCouncil, advanceCouncil } from "./council.ts";
import type { Game } from "./model.ts";
import { advanceCrew } from "./crew.ts";
export { command } from "./commands.ts";
import { buildings } from "./catalog.ts";
import { stepBattle } from "./battle.ts";
export function newGame(): Game {
  return {
    version: 2,
    council: newCouncil(),
    clock: 0,
    serial: 10,
    resources: { gold: 1250, wood: 900, food: 750 },
    buildings: [
      { id: "hall", kind: "hall", x: 4, y: 4, level: 1, stored: 0 },
      { id: "mine", kind: "mine", x: 2, y: 3, level: 1, stored: 180 },
      { id: "mill", kind: "mill", x: 6, y: 2, level: 1, stored: 140 },
      { id: "farm", kind: "farm", x: 2, y: 6, level: 1, stored: 160 },
      { id: "barracks", kind: "barracks", x: 6, y: 6, level: 1, stored: 0 },
      { id: "tower", kind: "tower", x: 4, y: 7, level: 1, stored: 0 },
    ],
    army: { knight: 10, archer: 8, catapult: 2 },
    training: [],
    trophies: 0,
    unlocked: 0,
    stats: { collected: 0, built: 0, upgraded: 0, wins: 0 },
    claimed: [],
  };
}
export function advanceGame(state: Game, seconds: number, combat = true): Game {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(28800, seconds);
  let g = structuredClone(state);
  const before = g.clock;
  g.clock += dt;
  for (const b of g.buildings) {
    const d = buildings[b.kind];
    const activeFrom = b.readyAt ?? before;
    if (b.readyAt !== undefined && b.readyAt <= g.clock) {
      if (!b.constructing) {
        b.level++;
        g.stats.upgraded++;
      }
      b.readyAt = undefined;
      b.constructing = false;
    }
    if (!b.readyAt && d.resource)
      b.stored = Math.min(
        d.capacity * b.level,
        b.stored +
          Math.max(0, g.clock - Math.max(before, activeFrom)) *
            d.rate *
            b.level,
      );
  }
  for (const t of g.training.filter((t) => t.readyAt <= g.clock))
    g.army[t.kind]++;
  g.training = g.training.filter((t) => t.readyAt > g.clock);
  if (combat && g.battle && !g.battle.result)
    g = stepBattle(g, Math.min(dt, 1));
  if (combat) {
    g = advanceCouncil(g, seconds);
    g = advanceCrew(g, seconds);
  }
  return g;
}
export { parseSave as restoreGame } from "./persistence.ts";
