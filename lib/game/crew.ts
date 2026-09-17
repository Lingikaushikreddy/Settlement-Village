import type {
  Building,
  Game,
  Resource,
  Resources,
  TroopKind,
} from "./model.ts";
import type {
  CrewAgent,
  CrewCommand,
  CrewEvent,
  CrewState,
  CrewTask,
  ObjectiveKind,
} from "./crew-types.ts";
import { armySize, buildings, troops } from "./catalog.ts";
import { command } from "./commands.ts";
export const crewRoster = [
  {
    id: "mira",
    name: "Mira",
    role: "Farmer",
    color: "#bb784f",
    specialty: "Food collection",
  },
  {
    id: "theo",
    name: "Theo",
    role: "Trader",
    color: "#627ba4",
    specialty: "Gold collection",
  },
  {
    id: "ada",
    name: "Ada",
    role: "Baker",
    color: "#9ba158",
    specialty: "Food supplies",
  },
  {
    id: "finn",
    name: "Finn",
    role: "Waterkeeper",
    color: "#b99b56",
    specialty: "Knight and archer coordination",
  },
  {
    id: "lina",
    name: "Lina",
    role: "Carpenter",
    color: "#aa829d",
    specialty: "Timber collection and siege assembly",
  },
  {
    id: "oscar",
    name: "Oscar",
    role: "Gardener",
    color: "#718a69",
    specialty: "Harvest and timber collection",
  },
] as const;
const resourceKeys: Resource[] = ["gold", "wood", "food"];
const troopKeys: TroopKind[] = ["knight", "archer", "catapult"];
const zero = (): Resources => ({ gold: 0, wood: 0, food: 0 });
const ready = (g: Game) => troopKeys.reduce((n, k) => n + g.army[k], 0);
function recruits(g: Game): Record<TroopKind, number> {
  const desired = { knight: 14, archer: 12, catapult: 4 };
  const have = { ...g.army };
  for (const t of g.training) have[t.kind]++;
  let left = Math.max(0, 30 - armySize(g));
  const result = { knight: 0, archer: 0, catapult: 0 };
  for (const k of troopKeys) {
    result[k] = Math.min(left, Math.max(0, desired[k] - have[k]));
    left -= result[k];
  }
  return result;
}
function cost(kind: TroopKind, count: number): Resources {
  return {
    gold: troops[kind].cost.gold * count,
    wood: troops[kind].cost.wood * count,
    food: troops[kind].cost.food * count,
  };
}
function recruitCost(g: Game): Resources {
  const counts = recruits(g),
    sum = zero();
  for (const k of troopKeys)
    for (const r of resourceKeys) sum[r] += troops[k].cost[r] * counts[k];
  return sum;
}
export function crewPreview(g: Game, kind: ObjectiveKind) {
  return {
    targetArmy: kind === "raid" ? 30 : 0,
    reserves:
      kind === "raid"
        ? { gold: 1200, wood: 800, food: 600 }
        : {
            gold: g.resources.gold + 300,
            wood: g.resources.wood + 300,
            food: g.resources.food + 300,
          },
    budget: kind === "raid" ? recruitCost(g) : zero(),
  };
}
export function newCrew(g: Game): CrewState {
  const empty: { x: number; y: number }[] = [];
  for (let y = 3; y <= 8; y++)
    for (let x = 3; x <= 8; x++)
      if (!g.buildings.some((b) => b.x === x && b.y === y))
        empty.push({ x, y });
  return {
    version: 1,
    tick: 0,
    timer: 0,
    playing: false,
    status: "idle",
    objective: null,
    tasks: [],
    events: [],
    agents: crewRoster.map((a, i) => ({
      id: a.id,
      ...(empty[i] ?? { x: 0, y: 0 }),
      task: null,
      status: "idle",
      restUntil: 0,
      experience: 0,
      completed: 0,
      reason: "Waiting for a village objective.",
      plan: [],
      memories: [],
    })),
  };
}
function event(
  c: CrewState,
  actor: string,
  type: CrewEvent["type"],
  text: string,
) {
  const last = c.events.at(-1);
  const index =
    last?.tick === c.tick ? Number(last.id.split("-").at(-1)) + 1 : 0;
  c.events.push({ id: `${c.tick}-${index}`, tick: c.tick, actor, type, text });
  c.events = c.events.slice(-120);
}
function remember(c: CrewState, a: CrewAgent, text: string) {
  a.memories.push({ tick: c.tick, text });
  a.memories = a.memories.slice(-12);
}
function release(c: CrewState, a: CrewAgent, reason: string) {
  const task = c.tasks.find((t) => t.id === a.task);
  if (task) {
    task.assignee = null;
    task.work = 0;
  }
  a.task = null;
  a.plan = [];
  a.reason = reason;
  a.status = a.restUntil > c.tick ? "resting" : "idle";
}
export function crewCommand(game: Game, action: CrewCommand): Game {
  const g = structuredClone(game);
  g.crew ??= newCrew(g);
  const c = g.crew;
  if (action.type === "start") {
    if (g.battle)
      throw Error("Finish your raid before setting village orders.");
    for (const a of c.agents) release(c, a, "A new objective is ready.");
    c.tasks = [];
    c.timer = 0;
    c.playing = true;
    c.status = "active";
    c.objective = {
      kind: action.kind,
      startedTick: c.tick,
      ...crewPreview(g, action.kind),
      spent: zero(),
    };
    if (g.council) g.council.playing = false;
    event(
      c,
      "crew",
      "objective",
      action.kind === "raid"
        ? "Prepare 30 ready troops and village reserves."
        : "Collect 300 more of each resource.",
    );
    refresh(g);
  } else if (action.type === "pause") c.playing = false;
  else if (action.type === "resume") {
    if (c.status === "active" && !g.battle) {
      c.playing = true;
      if (g.council) g.council.playing = false;
    }
  } else if (action.type === "cancel") {
    for (const a of c.agents) release(c, a, "Objective cancelled.");
    c.tasks = [];
    c.objective = null;
    c.status = "idle";
    c.playing = false;
    c.timer = 0;
    event(c, "crew", "objective", "Village objective cancelled.");
  } else if (action.type === "rest") {
    const a = c.agents.find((a) => a.id === action.id);
    if (!a) throw Error("Resident not found.");
    const task = c.tasks.find((t) => t.id === a.task);
    a.restUntil = c.tick + 20;
    const reason = task
      ? `Released ${task.label} for another resident; resting for 20 ticks.`
      : "Resting for 20 ticks.";
    release(c, a, reason);
    remember(c, a, reason);
    event(c, a.id, "adapt", reason);
  }
  return g;
}
export function crewProgress(g: Game) {
  const o = g.crew?.objective;
  const resources = resourceKeys.map((resource) => ({
    resource,
    current: g.resources[resource],
    target: o?.reserves[resource] ?? 0,
  }));
  const parts = resources.map((r) =>
    r.target ? Math.min(1, r.current / r.target) : 1,
  );
  if (o?.targetArmy) parts.push(Math.min(1, ready(g) / o.targetArmy));
  return {
    percent: o
      ? Math.floor((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
      : 0,
    readyTroops: ready(g),
    targetTroops: o?.targetArmy ?? 0,
    resources,
  };
}
type Point = { x: number; y: number };
function route(g: Game, a: Point, b: Building): Point[] | null {
  const adjacent = (p: Point) =>
    Math.abs(p.x - b.x) + Math.abs(p.y - b.y) === 1;
  const occupied = new Set(g.buildings.map((b) => `${b.x},${b.y}`));
  if (adjacent(a) && !occupied.has(`${a.x},${a.y}`)) return [];
  const queue: { point: Point; path: Point[] }[] = [{ point: a, path: [] }];
  const seen = new Set([`${a.x},${a.y}`]);
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
        seen.has(key) ||
        occupied.has(key)
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
function blocked(g: Game, t: CrewTask): string | null {
  const b = g.buildings.find((b) => b.id === t.buildingId);
  if (!b) return "Workplace is missing.";
  if (b.readyAt !== undefined || b.constructing)
    return "Workplace construction is in progress.";
  if (t.kind === "collect")
    return Math.floor(b.stored) < 1 ? "Waiting for production." : null;
  if (!t.troop) return "Choose a troop type.";
  if (g.training.length)
    return "Training queue is occupied; waiting for ready troops.";
  if (armySize(g) + t.count > 40) return "Army camp is full.";
  const o = g.crew!.objective!,
    price = cost(t.troop, t.count);
  if (resourceKeys.some((r) => o.spent[r] + price[r] > o.budget[r]))
    return "Initial recruitment budget reached; set a new objective to authorize more.";
  const missing = resourceKeys.filter((r) => g.resources[r] < price[r]);
  return missing.length
    ? `Collect ${missing.join(" and ")} to fund training.`
    : null;
}
function refresh(g: Game) {
  const c = g.crew!,
    o = c.objective!;
  if (
    ready(g) >= o.targetArmy &&
    resourceKeys.every((r) => g.resources[r] >= o.reserves[r])
  ) {
    for (const a of c.agents) release(c, a, "Objective complete.");
    c.tasks = [];
    c.status = "complete";
    c.playing = false;
    c.timer = 0;
    event(
      c,
      "crew",
      "complete",
      o.kind === "raid"
        ? "Raid preparations complete. Your army is ready for your orders."
        : "Village restocked. All resource targets reached.",
    );
    return;
  }
  const jobs: CrewTask[] = [];
  const needs = o.kind === "raid" ? recruitCost(g) : zero();
  for (const b of g.buildings) {
    const resource = buildings[b.kind].resource;
    if (
      !resource ||
      g.resources[resource] >= o.reserves[resource] + needs[resource]
    )
      continue;
    jobs.push({
      id: `collect:${b.id}`,
      kind: "collect",
      buildingId: b.id,
      resource,
      count: 1,
      priority: 90,
      label: `Collect ${resource}`,
      reason: `Supply ${resource} for the objective and recruitment.`,
      blocked: null,
      assignee: null,
      work: 0,
    });
  }
  if (o.kind === "raid") {
    const counts = recruits(g);
    const barracks = g.buildings.filter((b) => b.kind === "barracks");
    const completed = barracks.filter(
      (b) => b.readyAt === undefined && !b.constructing,
    );
    const b =
      completed.find((b) => c.agents.some((a) => route(g, a, b) !== null)) ??
      completed[0] ??
      barracks[0];
    for (const troop of troopKeys)
      if (counts[troop])
        jobs.push({
          id: `train:${troop}`,
          kind: "train",
          buildingId: b?.id ?? "missing-barracks",
          troop,
          count: Math.min(5, counts[troop]),
          priority: 100,
          label: `Train ${Math.min(5, counts[troop])} ${troops[troop].name.toLowerCase()}${Math.min(5, counts[troop]) === 1 ? "" : "s"}`,
          reason:
            "Recruit missing troops, counting both ready and queued units.",
          blocked: null,
          assignee: null,
          work: 0,
        });
  }
  for (const t of jobs) {
    t.blocked = blocked(g, t);
    const workplace = g.buildings.find((b) => b.id === t.buildingId);
    if (
      !t.blocked &&
      workplace &&
      c.agents.every((a) => route(g, a, workplace) === null)
    )
      t.blocked = "No walkable route to the workplace.";
    const old = c.tasks.find((old) => old.id === t.id);
    if (
      old &&
      old.count === t.count &&
      old.buildingId === t.buildingId &&
      !t.blocked
    ) {
      t.assignee = old.assignee;
      t.work = old.work;
    }
    if (old && old.blocked !== t.blocked && t.blocked)
      event(c, "crew", "adapt", `${t.label}: ${t.blocked}`);
  }
  for (const a of c.agents)
    if (a.task && !jobs.some((t) => t.id === a.task && t.assignee === a.id)) {
      const next = jobs.find((t) => t.id === a.task);
      const reason = next?.blocked ?? "Replanning from current village needs.";
      release(c, a, reason);
      remember(c, a, reason);
    }
  c.tasks = jobs.slice(0, 40);
}
function suitability(a: CrewAgent, t: CrewTask) {
  const special: Record<string, string[]> = {
    mira: ["food"],
    theo: ["gold"],
    ada: ["food"],
    finn: ["knight", "archer"],
    lina: ["wood", "catapult"],
    oscar: ["food", "wood"],
  };
  return special[a.id].includes(t.resource ?? t.troop ?? "") ? 12 : 0;
}
function assign(g: Game) {
  const c = g.crew!;
  for (const t of [...c.tasks].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  )) {
    if (t.assignee || t.blocked) continue;
    const b = g.buildings.find((b) => b.id === t.buildingId)!;
    const candidates = c.agents
      .filter((a) => !a.task && a.restUntil <= c.tick)
      .map((a) => ({ a, path: route(g, a, b) }))
      .filter((b) => b.path !== null);
    candidates.sort(
      (a, b) =>
        suitability(b.a, t) +
          b.a.experience / 10 -
          b.path!.length -
          (suitability(a.a, t) + a.a.experience / 10 - a.path!.length) ||
        a.a.id.localeCompare(b.a.id),
    );
    const winner = candidates[0];
    if (!winner) {
      if (!c.agents.some((a) => route(g, a, b) !== null))
        t.blocked = "No walkable route to the workplace.";
      continue;
    }
    const a = winner.a;
    t.assignee = a.id;
    a.task = t.id;
    a.status = "moving";
    a.reason = `Claimed ${t.label.toLowerCase()}: ${suitability(a, t) ? "role match, " : ""}${winner.path!.length} steps away; proficiency ${a.experience}.`;
    a.plan = [
      `Workplace ${b.x},${b.y}`,
      "Walk to the workplace.",
      "Work for two ticks.",
      "Execute the village command.",
    ];
    remember(c, a, a.reason);
    event(c, a.id, "claim", a.reason);
  }
}
function step(g: Game) {
  const c = g.crew!;
  c.tick++;
  for (const a of c.agents)
    if (a.restUntil <= c.tick && a.status === "resting") {
      a.status = "idle";
      a.reason = "Rested and ready to help.";
    }
  refresh(g);
  if (c.status !== "active") return;
  assign(g);
  for (const a of c.agents) {
    const t = c.tasks.find((t) => t.id === a.task);
    if (!t) continue;
    const reason = blocked(g, t);
    if (reason) {
      t.blocked = reason;
      release(c, a, reason);
      continue;
    }
    const b = g.buildings.find((b) => b.id === t.buildingId)!;
    const path = route(g, a, b);
    if (path === null) {
      t.blocked = "No walkable route to the workplace.";
      release(c, a, t.blocked);
      event(c, a.id, "adapt", a.reason);
      continue;
    }
    if (a.plan[0] !== `Workplace ${b.x},${b.y}`) {
      t.work = 0;
      a.plan[0] = `Workplace ${b.x},${b.y}`;
      a.reason = "Workplace moved; replanning the route.";
      remember(c, a, a.reason);
      event(c, a.id, "adapt", a.reason);
    }
    if (path.length) {
      a.x = path[0].x;
      a.y = path[0].y;
      a.status = "moving";
      t.work = 0;
      continue;
    }
    a.status = "working";
    a.reason = `Working: ${t.label.toLowerCase()}.`;
    t.work++;
    if (t.work < 2) continue;
    if (t.kind === "train" && (!t.troop || recruits(g)[t.troop] < t.count)) {
      release(c, a, "Army changed; reconsidering recruitment.");
      continue;
    }
    try {
      const before = { ...g.resources };
      const next = command(
        g,
        t.kind === "collect"
          ? { type: "collect", id: t.buildingId }
          : { type: "train", kind: t.troop!, count: t.count },
      );
      g.resources = next.resources;
      g.buildings = next.buildings;
      g.training = next.training;
      g.stats = next.stats;
      if (t.kind === "train")
        for (const r of resourceKeys)
          c.objective!.spent[r] += before[r] - g.resources[r];
      const done =
        t.kind === "collect"
          ? `Collected ${g.resources[t.resource!] - before[t.resource!]} ${t.resource}.`
          : `Queued ${t.count} ${troops[t.troop!].name.toLowerCase()}${t.count === 1 ? "" : "s"} for training.`;
      a.experience = Math.min(100, a.experience + 1);
      a.completed = Math.min(1000000, a.completed + 1);
      remember(c, a, done);
      event(c, a.id, "action", done);
      release(c, a, done);
      c.tasks = c.tasks.filter((job) => job.id !== t.id);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Village command could not execute.";
      release(c, a, text);
      event(c, a.id, "adapt", text);
    }
  }
  refresh(g);
  for (const a of c.agents)
    if (!a.task && a.restUntil <= c.tick && c.status === "active") {
      a.status = "waiting";
      a.reason =
        c.tasks.find((t) => t.blocked)?.blocked ??
        "Other residents have claimed the available work.";
    }
}
export function advanceCrew(game: Game, seconds: number): Game {
  if (
    !game.crew?.playing ||
    game.crew.status !== "active" ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 1 ||
    game.council?.playing ||
    game.battle
  )
    return game;
  const g = structuredClone(game),
    c = g.crew!;
  c.timer += seconds;
  if (c.timer + 1e-9 >= 1) {
    c.timer = Math.max(0, c.timer - 1);
    step(g);
  }
  return g;
}
