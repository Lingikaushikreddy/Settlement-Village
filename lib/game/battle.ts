import type { Game, TroopKind, BuildingKind } from "./model.ts";
import { troops, opponents } from "./catalog.ts";
export const zones = {
  north: { x: 0, y: 0 },
  west: { x: 0, y: 8 },
  south: { x: 8, y: 8 },
  east: { x: 8, y: 0 },
};
export function startBattle(state: Game, level: number): Game {
  if (!Number.isInteger(level) || !opponents[level] || level > state.unlocked)
    throw Error("Win a star in the previous raid to unlock this stronghold.");
  if (state.battle && !state.battle.settled)
    throw Error("Finish your current raid first.");
  if (!Object.values(state.army).some((n) => n > 0))
    throw Error("Train troops before starting a raid.");
  const g = structuredClone(state);
  const layout: [BuildingKind, number, number][] = [
    ["hall", 4, 4],
    ["tower", 2, 4],
    ["tower", 6, 4],
    ["mine", 3, 2],
    ["mill", 5, 6],
    ["barracks", 6, 2],
    ["farm", 2, 6],
  ];
  if (level > 0) layout.push(["tower", 4, 1]);
  if (level > 1) layout.push(["tower", 4, 7]);
  g.battle = {
    level,
    elapsed: 0,
    units: [],
    deployed: 0,
    buildings: layout.map(([kind, x, y], i) => {
      const hp =
        (kind === "hall" ? 580 : kind === "tower" ? 280 : 220) *
        (1 + level * 0.8);
      return { id: `e-${i}`, kind, x, y, hp, maxHp: hp };
    }),
  };
  return g;
}
export function deploy(
  state: Game,
  kind: TroopKind,
  zone: string,
  count = 1,
): Game {
  if (!state.battle || state.battle.result)
    throw Error("Choose an active raid.");
  if (!(zone in zones)) throw Error("Choose a deployment zone along the edge.");
  if (
    !troops[kind] ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 5 ||
    state.army[kind] < count
  )
    throw Error("Not enough troops in reserve.");
  const g = structuredClone(state),
    b = g.battle!,
    p = zones[zone as keyof typeof zones],
    t = troops[kind];
  g.army[kind] -= count;
  for (let i = 0; i < count; i++) {
    const offset = ((b.deployed % 3) - 1) * 0.18;
    b.units.push({
      id: `u-${++g.serial}`,
      kind,
      x: p.x + offset,
      y: p.y - offset,
      hp: t.hp,
      maxHp: t.hp,
    });
    b.deployed++;
  }
  return g;
}
export function focusTarget(state: Game, id: string) {
  const g = structuredClone(state);
  if (
    g.battle &&
    !g.battle.result &&
    g.battle.buildings.some((b) => b.id === id && b.hp > 0)
  )
    g.battle.focus = id;
  return g;
}
export function stepBattle(state: Game, seconds: number): Game {
  if (!state.battle || state.battle.result) return state;
  const g = structuredClone(state),
    b = g.battle!,
    dt = Math.max(0, Math.min(seconds, 1));
  // Scouting time is free: the raid clock starts with the first deployed troop.
  if (b.deployed > 0) b.elapsed += dt;
  for (const u of b.units.filter((u) => u.hp > 0)) {
    const alive = b.buildings.filter((e) => e.hp > 0);
    const target =
      alive.find((e) => e.id === b.focus) ||
      alive.sort(
        (a, z) =>
          Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(z.x - u.x, z.y - u.y),
      )[0];
    u.attacking = false;
    if (!target) break;
    u.target = target.id;
    const t = troops[u.kind],
      dx = target.x - u.x,
      dy = target.y - u.y,
      dist = Math.hypot(dx, dy);
    if (dist <= t.range) {
      target.hp = Math.max(0, target.hp - t.damage * dt);
      u.attacking = true;
    } else {
      const move = Math.min(t.speed * dt, dist - t.range);
      u.x += (dx / dist) * move;
      u.y += (dy / dist) * move;
    }
  }
  for (const tower of b.buildings.filter(
    (e) => e.kind === "tower" && e.hp > 0,
  )) {
    const u = b.units
      .filter(
        (u) => u.hp > 0 && Math.hypot(u.x - tower.x, u.y - tower.y) <= 3.8,
      )
      .sort(
        (a, z) =>
          Math.hypot(a.x - tower.x, a.y - tower.y) -
          Math.hypot(z.x - tower.x, z.y - tower.y),
      )[0];
    if (u) u.hp = Math.max(0, u.hp - (16 + b.level * 15) * dt);
  }
  const destroyed = b.buildings.filter((e) => e.hp <= 0).length;
  if (
    destroyed === b.buildings.length ||
    b.elapsed >= 90 ||
    (b.deployed > 0 &&
      b.units.every((u) => u.hp <= 0) &&
      Object.values(g.army).every((n) => n === 0))
  )
    finish(g);
  return g;
}
function finish(g: Game) {
  const b = g.battle!,
    o = opponents[b.level];
  const pct = Math.floor(
    (b.buildings.filter((e) => e.hp <= 0).length / b.buildings.length) * 100,
  );
  const hall = b.buildings.find((e) => e.kind === "hall")!;
  const stars = Number(hall.hp <= 0) + Number(pct >= 50) + Number(pct === 100);
  const ratio = pct / 100;
  b.result = {
    stars,
    destruction: pct,
    gold: Math.floor(o.gold * ratio),
    wood: Math.floor(o.wood * ratio),
    food: Math.floor(o.food * ratio),
  };
}
export function retreat(state: Game) {
  const g = structuredClone(state);
  if (g.battle && !g.battle.result) finish(g);
  return g;
}
export function settleBattle(state: Game): Game {
  if (!state.battle?.result || state.battle.settled) return state;
  const g = structuredClone(state),
    b = g.battle!,
    r = b.result!;
  for (const k of ["gold", "wood", "food"] as const) g.resources[k] += r[k];
  g.trophies += r.stars * 12;
  if (r.stars > 0) {
    g.stats.wins++;
    g.unlocked = Math.min(2, Math.max(g.unlocked, b.level + 1));
  }
  b.settled = true;
  return g;
}
