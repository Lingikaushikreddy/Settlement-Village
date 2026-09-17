import type { Game, Command, Resources } from "./model.ts";
import {
  buildings,
  troops,
  quests,
  upgradeCost,
  freeBuilders,
  armySize,
} from "./catalog.ts";
function pay(g: Game, cost: Resources) {
  for (const k of ["gold", "wood", "food"] as const)
    if (g.resources[k] < cost[k])
      throw Error(`Not enough ${k}. Collect more from your village.`);
  for (const k of ["gold", "wood", "food"] as const) g.resources[k] -= cost[k];
}
function checkTile(g: Game, x: number, y: number, except?: string) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x > 8 ||
    y < 0 ||
    y > 8
  )
    throw Error("Choose a tile inside the village.");
  if (g.buildings.some((b) => b.id !== except && b.x === x && b.y === y))
    throw Error("That tile is occupied. Choose an empty tile.");
}
export function command(state: Game, c: Command): Game {
  const g = structuredClone(state);
  if (g.battle && !g.battle.result)
    throw Error("Finish your raid before managing the village.");
  if (c.type === "build") {
    if (!buildings[c.kind] || c.kind === "hall")
      throw Error("Choose a village building.");
    checkTile(g, c.x, c.y);
    if (g.buildings.length >= 30)
      throw Error("Your village has reached its 30-building limit.");
    if (freeBuilders(g) < 1)
      throw Error("Both builders are busy. Wait for construction to finish.");
    pay(g, buildings[c.kind].cost);
    g.buildings.push({
      id: `b-${++g.serial}`,
      kind: c.kind,
      x: c.x,
      y: c.y,
      level: 1,
      stored: 0,
      constructing: true,
      readyAt: g.clock + buildings[c.kind].seconds,
    });
    g.stats.built++;
  } else if (c.type === "train") {
    if (
      !troops[c.kind] ||
      !Number.isInteger(c.count) ||
      c.count < 1 ||
      c.count > 5
    )
      throw Error("Choose a troop count from 1 to 5.");
    if (!g.buildings.some((b) => b.kind === "barracks" && !b.readyAt))
      throw Error("Your barracks must be ready to train troops.");
    if (armySize(g) + c.count > 40)
      throw Error("Army camp full. Take troops on a raid first (40 capacity).");
    const t = troops[c.kind];
    pay(g, {
      gold: t.cost.gold * c.count,
      wood: t.cost.wood * c.count,
      food: t.cost.food * c.count,
    });
    let end = Math.max(g.clock, g.training.at(-1)?.readyAt ?? 0);
    for (let i = 0; i < c.count; i++) {
      end += t.seconds;
      g.training.push({ kind: c.kind, readyAt: end });
    }
  } else if (c.type === "claim") {
    const q = quests.find((q) => q.id === c.id);
    if (!q || g.claimed.includes(c.id) || g.stats[q.stat] < q.goal)
      throw Error("Complete this goal before claiming its reward.");
    g.resources.gold += q.reward;
    g.claimed.push(c.id);
  } else {
    const b = g.buildings.find((b) => b.id === c.id);
    if (!b) throw Error("Building not found.");
    const def = buildings[b.kind];
    if (c.type === "move") {
      if (b.readyAt) throw Error("Construction is in progress.");
      checkTile(g, c.x, c.y, b.id);
      b.x = c.x;
      b.y = c.y;
    }
    if (c.type === "collect") {
      if (def.resource) {
        const count = Math.floor(b.stored);
        g.resources[def.resource] += count;
        b.stored -= count;
        g.stats.collected += count;
      }
    }
    if (c.type === "upgrade") {
      if (b.readyAt) throw Error("An upgrade is already in progress.");
      if (b.level >= 5) throw Error("This building is at its maximum level.");
      const hall = g.buildings.find((b) => b.kind === "hall")!;
      if (b.kind !== "hall" && b.level >= hall.level + 1)
        throw Error("Upgrade your town hall to unlock this building level.");
      if (freeBuilders(g) < 1) throw Error("Both builders are busy.");
      pay(g, upgradeCost(b.kind, b.level));
      b.readyAt = g.clock + def.seconds * (b.level + 1);
    }
  }
  return g;
}
