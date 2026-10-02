import { z } from "zod";
import type { Building, Game, Resources } from "./model.ts";
import { buildings, freeBuilders, upgradeCost } from "./catalog.ts";

export type Point = { x: number; y: number };
export type DevelopmentStep = {
  id: string;
  label: string;
  kind: "build" | "upgrade";
  target: "hall" | "farm";
  targetLevel: number;
  cost: Resources;
  dependsOn: string[];
};
export type DevelopmentPlan = {
  version: 1;
  hallId: string;
  farmId: string | null;
  existingFarmIds: string[];
  reserveFloor: Resources;
  steps: DevelopmentStep[];
};
export type DevelopmentStepView = DevelopmentStep & {
  status: "pending" | "ready" | "blocked" | "building" | "complete";
  reason: string | null;
  buildingId: string | null;
  x?: number;
  y?: number;
};
const keys = ["gold", "wood", "food"] as const;
const zero = (): Resources => ({ gold: 0, wood: 0, food: 0 });
const amount = z.number().finite().nonnegative().max(1e12);
const resources = z.object({ gold: amount, wood: amount, food: amount });
const id = z.string().min(1).max(80);
export const developmentPlanSchema = z
  .object({
    version: z.literal(1),
    hallId: id,
    farmId: id.nullable(),
    existingFarmIds: z.array(id).max(30),
    reserveFloor: resources,
    steps: z
      .array(
        z.object({
          id: z.enum(["hall-2", "farm-build", "farm-2", "farm-3"]),
          label: z.string().min(1).max(100),
          kind: z.enum(["build", "upgrade"]),
          target: z.enum(["hall", "farm"]),
          targetLevel: z.number().int().min(1).max(3),
          cost: resources,
          dependsOn: z.array(z.string()).max(2),
        }),
      )
      .min(3)
      .max(4),
  })
  .superRefine((p, ctx) => {
    const expected =
      p.steps.length === 4
        ? ["hall-2", "farm-build", "farm-2", "farm-3"]
        : ["farm-build", "farm-2", "farm-3"];
    let invalid =
      new Set(p.existingFarmIds).size !== p.existingFarmIds.length ||
      (p.farmId !== null && p.existingFarmIds.includes(p.farmId));
    p.steps.forEach((s, i) => {
      const deps =
        s.id === "farm-2"
          ? ["farm-build"]
          : s.id === "farm-3"
            ? ["farm-2", ...(p.steps.length === 4 ? ["hall-2"] : [])]
            : [];
      invalid ||=
        s.id !== expected[i] ||
        s.target !== (s.id === "hall-2" ? "hall" : "farm") ||
        s.kind !== (s.id === "farm-build" ? "build" : "upgrade") ||
        s.targetLevel !==
          (s.id === "farm-build" ? 1 : s.id === "farm-3" ? 3 : 2) ||
        JSON.stringify(s.dependsOn) !== JSON.stringify(deps);
    });
    if (invalid)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid development dependency plan.",
      });
  });

export function developmentPreview(g: Game) {
  const hall = g.buildings.find((b) => b.kind === "hall")!;
  const needsHall = hall.level < 2;
  const steps: DevelopmentStep[] = [];
  if (needsHall)
    steps.push({
      id: "hall-2",
      label: "Upgrade Town hall to level 2",
      kind: "upgrade",
      target: "hall",
      targetLevel: 2,
      cost: hall.readyAt !== undefined ? zero() : upgradeCost("hall", 1),
      dependsOn: [],
    });
  steps.push(
    {
      id: "farm-build",
      label: "Build an additional farm",
      kind: "build",
      target: "farm",
      targetLevel: 1,
      cost: { ...buildings.farm.cost },
      dependsOn: [],
    },
    {
      id: "farm-2",
      label: "Upgrade the new farm to level 2",
      kind: "upgrade",
      target: "farm",
      targetLevel: 2,
      cost: upgradeCost("farm", 1),
      dependsOn: ["farm-build"],
    },
    {
      id: "farm-3",
      label: "Upgrade the new farm to level 3",
      kind: "upgrade",
      target: "farm",
      targetLevel: 3,
      cost: upgradeCost("farm", 2),
      dependsOn: ["farm-2", ...(needsHall ? ["hall-2"] : [])],
    },
  );
  const budget = zero();
  for (const s of steps) for (const r of keys) budget[r] += s.cost[r];
  const reserves = { gold: 250, wood: 200, food: 150 };
  const development: DevelopmentPlan = {
    version: 1,
    hallId: hall.id,
    farmId: null,
    existingFarmIds: g.buildings
      .filter((b) => b.kind === "farm")
      .map((b) => b.id),
    reserveFloor: { ...reserves },
    steps,
  };
  return { targetArmy: 0, reserves, budget, development };
}

// Both visible routes and real execution use this deterministic grid search.
export function walkRoute(g: Game, from: Point, target: Point): Point[] | null {
  const occupied = new Set(g.buildings.map((b) => `${b.x},${b.y}`));
  occupied.add(`${target.x},${target.y}`);
  const adjacent = (p: Point) =>
    Math.abs(p.x - target.x) + Math.abs(p.y - target.y) === 1;
  if (adjacent(from) && !occupied.has(`${from.x},${from.y}`)) return [];
  const queue = [{ point: from, path: [] as Point[] }];
  const seen = new Set([`${from.x},${from.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const { point, path } = queue[i];
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const next = { x: point.x + dx, y: point.y + dy },
        key = `${next.x},${next.y}`;
      if (
        next.x < 0 ||
        next.x > 8 ||
        next.y < 0 ||
        next.y > 8 ||
        occupied.has(key) ||
        seen.has(key)
      )
        continue;
      const steps = [...path, next];
      if (adjacent(next)) return steps;
      seen.add(key);
      queue.push({ point: next, path: steps });
    }
  }
  return null;
}
function origins(g: Game): Point[] {
  if (g.crew) return g.crew.agents;
  const empty: Point[] = [];
  for (let y = 3; y <= 8; y++)
    for (let x = 3; x <= 8; x++)
      if (!g.buildings.some((b) => b.x === x && b.y === y))
        empty.push({ x, y });
  return empty.slice(0, 6);
}
export function developmentFarm(
  g: Game,
  p: DevelopmentPlan,
): Building | undefined {
  return p.farmId
    ? g.buildings.find((b) => b.id === p.farmId && b.kind === "farm")
    : g.buildings
        .filter((b) => b.kind === "farm" && !p.existingFarmIds.includes(b.id))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
}
function constructionSite(g: Game): Point | null {
  if (g.buildings.length >= 30) return null;
  const crew = origins(g);
  const candidates: Point[] = [];
  for (let y = 0; y <= 8; y++)
    for (let x = 0; x <= 8; x++)
      if (
        !g.buildings.some((b) => b.x === x && b.y === y) &&
        !crew.some((a) => a.x === x && a.y === y)
      )
        candidates.push({ x, y });
  const anchor =
    g.buildings.find((b) => b.kind === "farm") ??
    g.buildings.find((b) => b.kind === "hall")!;
  candidates.sort(
    (a, b) =>
      Math.abs(a.x - anchor.x) +
        Math.abs(a.y - anchor.y) -
        (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y)) ||
      a.y - b.y ||
      a.x - b.x,
  );
  return (
    candidates.find((p) => {
      if (!crew.some((a) => walkRoute(g, a, p) !== null)) return false;
      // A new site must not seal off an already reachable workplace.
      const future: Game = {
        ...g,
        buildings: [
          ...g.buildings,
          { ...p, id: "planned-site", kind: "farm", level: 1, stored: 0 },
        ],
      };
      return g.buildings
        .filter((b) => b.kind === "hall" || buildings[b.kind].resource)
        .every(
          (b) =>
            !crew.some((a) => walkRoute(g, a, b) !== null) ||
            crew.some((a) => walkRoute(future, a, b) !== null),
        );
    }) ?? null
  );
}

export function developmentSteps(
  g: Game,
  plan = g.crew?.objective?.development,
): DevelopmentStepView[] {
  if (!plan) return [];
  const farm = developmentFarm(g, plan);
  const completed = new Set(
    plan.steps
      .filter((s) => {
        const b =
          s.target === "hall"
            ? g.buildings.find((b) => b.id === plan.hallId && b.kind === "hall")
            : farm;
        return (
          b &&
          b.level >= s.targetLevel &&
          !b.constructing &&
          (s.id !== "farm-3" || b.readyAt === undefined)
        );
      })
      .map((s) => s.id),
  );
  const site = farm ? null : constructionSite(g);
  return plan.steps.map((s) => {
    const b =
      s.target === "hall"
        ? g.buildings.find((b) => b.id === plan.hallId && b.kind === "hall")
        : farm;
    const view: DevelopmentStepView = {
      ...s,
      status: "ready",
      reason: null,
      buildingId: b?.id ?? null,
      ...(b ? { x: b.x, y: b.y } : (site ?? {})),
    };
    if (completed.has(s.id)) return { ...view, status: "complete" };
    if (
      b?.readyAt !== undefined &&
      (s.kind === "build" || (!b.constructing && b.level + 1 >= s.targetLevel))
    )
      return {
        ...view,
        status: "building",
        reason: "Construction is in progress.",
      };
    const pending = s.dependsOn.filter((id) => !completed.has(id));
    if (pending.length)
      return {
        ...view,
        status: "pending",
        reason: `Waiting for ${pending.map((id) => plan.steps.find((s) => s.id === id)!.label.toLowerCase()).join(" and ")}.`,
      };
    let reason: string | null = null;
    if (s.kind === "build" && !site)
      reason =
        g.buildings.length >= 30
          ? "Village building limit reached."
          : "No reachable construction site. Move buildings to open a route.";
    else if (s.kind === "upgrade" && !b)
      reason = "The planned building is missing.";
    else if (freeBuilders(g) < 1)
      reason = "Both builders are busy; waiting for construction to finish.";
    else if (s.kind === "upgrade" && b && b.level >= 5)
      reason = "The planned building is already at maximum level.";
    else if (
      s.kind === "upgrade" &&
      b &&
      b.kind !== "hall" &&
      b.level >= (g.buildings.find((b) => b.kind === "hall")?.level ?? 0) + 1
    )
      reason = "Waiting for the Town hall prerequisite.";
    const price =
      s.kind === "build"
        ? buildings.farm.cost
        : b
          ? upgradeCost(b.kind, b.level)
          : s.cost;
    const objective =
      g.crew?.objective?.development === plan ? g.crew.objective : null;
    if (
      !reason &&
      objective &&
      keys.some((r) => objective.spent[r] + price[r] > objective.budget[r])
    )
      reason =
        "Development budget reached. Set a new objective to authorize more.";
    if (
      !reason &&
      keys.some((r) => g.resources[r] - price[r] < plan.reserveFloor[r])
    )
      reason = "Collect supplies while keeping the protected village reserves.";
    if (!reason && b && origins(g).every((a) => walkRoute(g, a, b) === null))
      reason = "No walkable route to the workplace.";
    return reason ? { ...view, status: "blocked", reason } : view;
  });
}
