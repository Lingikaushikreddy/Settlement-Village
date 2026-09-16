import { z } from "zod";
import {
  advance,
  createRun,
  metrics,
  policyInfo,
  runToEnd,
  ENGINE_VERSION,
} from "../sim/engine.ts";
import type { Run, Policy, Scenario } from "../sim/types.ts";
import type { Game, Resources, BuildingKind } from "./model.ts";

export const CHAPTER_TICKS = 32;
export const COUNCIL_SECONDS = 2;
export const chapters: {
  scenario: Scenario;
  title: string;
  subtitle: string;
  seed: number;
}[] = [
  {
    scenario: "scarcity",
    title: "The Missing Grain",
    subtitle: "A rumor reaches your market. Who will check the truth?",
    seed: 42,
  },
  {
    scenario: "reputation",
    title: "A Question of Trust",
    subtitle: "An accusation threatens an honest neighbor.",
    seed: 59,
  },
  {
    scenario: "injection",
    title: "The Forged Notice",
    subtitle: "An official-looking order arrives without authority.",
    seed: 76,
  },
  {
    scenario: "benign",
    title: "An Honest Offer",
    subtitle: "Can your village accept help when it is real?",
    seed: 93,
  },
];
const policySchema = z.enum(["baseline", "cautious", "evidence"]);
const interventionSchema = z.object({
  tick: z.number().int().min(1).max(CHAPTER_TICKS),
  type: z.enum(["publish-stock", "add-grain"]),
});
const signed = z.number().int().min(-1000).max(1000);
const ledgerSchema = z.object({
  id: z.string().min(1).max(120),
  chapter: z.number().int().min(0).max(3),
  tick: z.number().int().min(1).max(CHAPTER_TICKS),
  kind: z.enum(["work", "trade", "harm", "order"]),
  actor: z.string().min(1).max(40),
  source: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  delta: z.object({ gold: signed, wood: signed, food: signed }),
  uncovered: z.number().int().min(0).max(1000).default(0),
});
export const councilSaveSchema = z
  .object({
    version: z.literal(1),
    engineVersion: z.literal(ENGINE_VERSION),
    chapter: z.number().int().min(0).max(3),
    policy: policySchema,
    tick: z.number().int().min(0).max(CHAPTER_TICKS),
    timer: z.number().finite().min(0).max(COUNCIL_SECONDS),
    playing: z.boolean(),
    interventions: z.array(interventionSchema).max(CHAPTER_TICKS),
    ledger: z.array(ledgerSchema).max(2048),
    history: z
      .array(
        z.object({
          chapter: z.number().int().min(0).max(2),
          policy: policySchema,
          interventions: z.array(interventionSchema).max(CHAPTER_TICKS),
        }),
      )
      .max(3),
  })
  .superRefine((c, ctx) => {
    const ordered = (list: { tick: number }[], end: number) =>
      list.every((x, i) => x.tick <= end && (!i || x.tick > list[i - 1].tick));
    if (
      c.history.length !== c.chapter ||
      c.history.some(
        (h, i) => h.chapter !== i || !ordered(h.interventions, CHAPTER_TICKS),
      ) ||
      !ordered(c.interventions, c.tick) ||
      c.ledger.some(
        (e) =>
          e.chapter > c.chapter || (e.chapter === c.chapter && e.tick > c.tick),
      ) ||
      new Set(c.ledger.map((e) => e.id)).size !== c.ledger.length ||
      (c.tick === CHAPTER_TICKS && c.playing)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Council history is inconsistent.",
      });
    }
  });
export type CouncilState = z.infer<typeof councilSaveSchema>;
export type CouncilEntry = z.infer<typeof ledgerSchema>;
export type CouncilCommand =
  | { type: "play" | "pause" | "step" | "next" }
  | { type: "policy"; policy: Policy }
  | { type: "intervene"; action: "publish-stock" | "add-grain" };

export function newCouncil(): CouncilState {
  return {
    version: 1,
    engineVersion: ENGINE_VERSION,
    chapter: 0,
    policy: "baseline",
    tick: 0,
    timer: 0,
    playing: false,
    interventions: [],
    ledger: [],
    history: [],
  };
}
function config(c: Pick<CouncilState, "chapter" | "policy">) {
  const chapter = chapters[c.chapter];
  return {
    seed: chapter.seed,
    scenario: chapter.scenario,
    policy: c.policy,
    maxTicks: CHAPTER_TICKS,
  };
}
// Runs are derived evidence, never a second writable world or reward source.
const cache = new Map<string, Run>();
function key(c: CouncilState) {
  return JSON.stringify([c.chapter, c.policy, c.tick, c.interventions]);
}
function remember(c: CouncilState, run: Run) {
  cache.set(key(c), run);
  while (cache.size > 12) cache.delete(cache.keys().next().value!);
  return run;
}
export function councilRun(c: CouncilState): Run {
  const cached = cache.get(key(c));
  if (cached) return cached;
  let run = createRun(config(c));
  for (let tick = 1; tick <= c.tick; tick++) {
    run = advance(run, c.interventions.find((i) => i.tick === tick)?.type);
  }
  return remember(c, run);
}
/** A separate archive namespace preserves existing research runs with matching seeds. */
export function councilResearchRun(c: CouncilState): Run {
  const run = councilRun(c);
  return { ...run, id: `village-chapter-${c.chapter}-${run.id}` };
}
export function councilPending(run: Run) {
  return run.incidents.filter(
    (i) =>
      i.outcome === "pending" && ["pending", "checking"].includes(i.decision),
  );
}
export function residentView(run: Run, id: string, tick: number) {
  const at = Math.max(0, Math.min(run.snapshots.length - 1, Math.floor(tick)));
  const world = run.snapshots[at];
  const agent = world.agents.find((a) => a.id === id) ?? world.agents[0];
  const events = run.events.filter(
    (e) =>
      e.tick <= at &&
      (e.visibility === "public" || e.audience.includes(agent.id)),
  );
  const decision = run.decisions
    .filter((d) => d.actor === agent.id && d.tick <= at)
    .at(-1);
  return {
    agent,
    events,
    decision,
    memories: world.memories.filter(
      (m) => m.owner === agent.id && m.tick <= at,
    ),
  };
}
export function compareCouncil(c: CouncilState) {
  return (["baseline", "cautious", "evidence"] as const).map((policy) => {
    const run = runToEnd({ ...config(c), policy });
    return {
      policy,
      run,
      metrics: metrics(run),
      inspections: run.events.filter((e) => e.type === "inspection").length,
    };
  });
}
function readyLevel(g: Game, kind: BuildingKind) {
  return Math.max(
    0,
    ...g.buildings
      .filter((b) => b.kind === kind && !b.readyAt && !b.constructing)
      .map((b) => b.level),
  );
}
function append(
  g: Game,
  entry: Omit<CouncilEntry, "id" | "chapter" | "tick" | "uncovered"> & {
    uncovered?: number;
  },
) {
  const c = g.council!;
  const record: CouncilEntry = {
    ...entry,
    uncovered: entry.uncovered ?? 0,
    chapter: c.chapter,
    tick: c.tick,
    id: `${c.chapter}:${c.tick}:${entry.kind}:${entry.source}`,
  };
  if (c.ledger.some((e) => e.id === record.id))
    throw Error("This council effect was already recorded.");
  for (const r of ["gold", "wood", "food"] as const) {
    if (g.resources[r] + record.delta[r] < 0)
      throw Error(`Not enough ${r} for this council order.`);
    g.resources[r] += record.delta[r];
  }
  c.ledger.push(record);
}
function step(g: Game, order?: "publish-stock" | "add-grain") {
  const c = g.council!;
  if (c.tick >= CHAPTER_TICKS)
    throw Error("This chapter is complete. Continue to the next chapter.");
  const before = councilRun(c);
  if (order === "publish-stock" && before.snapshots.at(-1)!.verifiedStock)
    throw Error("The verified ledger is already published.");
  if (order) {
    const resource = order === "publish-stock" ? "gold" : "food";
    const cost = order === "publish-stock" ? 20 : 60;
    if (g.resources[resource] < cost)
      throw Error(`You need ${cost} ${resource} for this council order.`);
  }
  const after = advance(before, order);
  c.tick++;
  c.timer = 0;
  if (order) {
    c.interventions.push({ tick: c.tick, type: order });
    const event = after.events.find(
      (e) => e.tick === c.tick && e.type === "intervention",
    )!;
    append(g, {
      kind: "order",
      actor: "observer",
      source: event.id,
      label:
        order === "publish-stock"
          ? "Publish a verified stock ledger"
          : "Deliver twelve grain to the granary",
      delta:
        order === "publish-stock"
          ? { gold: -20, wood: 0, food: 0 }
          : { gold: 0, wood: 0, food: -60 },
    });
  }
  for (const event of after.events.filter((e) => e.tick === c.tick)) {
    if (event.type === "gather") {
      const decision = after.decisions.find(
        (d) => d.actor === event.actor && d.tick === c.tick,
      );
      const match = decision?.selected.match(
        /^Gather (\d+) (grain|wood|water)$/,
      );
      if (!match) continue;
      const amount = Number(match[1]);
      const delta: Resources = { gold: 0, wood: 0, food: 0 };
      if (match[2] === "grain") delta.food = amount * 4 * readyLevel(g, "farm");
      if (match[2] === "wood") delta.wood = amount * 4 * readyLevel(g, "mill");
      if (match[2] === "water")
        delta.gold = amount * 2 * Number(readyLevel(g, "hall") > 0);
      if (Object.values(delta).some((n) => n > 0))
        append(g, {
          kind: "work",
          actor: event.actor,
          source: event.id,
          label: `${event.actor[0].toUpperCase()}${event.actor.slice(1)} · ${match[2] === "water" ? "communal water service" : `${match[2]} work dividend`}`,
          delta,
        });
    }
    if (
      event.type === "trade" &&
      (!event.incidentId ||
        ["benign", "reputation"].includes(after.config.scenario)) &&
      readyLevel(g, "hall")
    ) {
      append(g, {
        kind: "trade",
        actor: event.actor,
        source: event.id,
        label: "A fair trade earns market revenue",
        delta: { gold: 6, wood: 0, food: 0 },
      });
    }
  }
  for (const incident of after.incidents) {
    const harm =
      incident.harm -
      (before.incidents.find((i) => i.id === incident.id)?.harm ?? 0);
    if (harm > 0) {
      const expected = harm * 20;
      const paid = Math.min(Math.floor(g.resources.gold), expected);
      append(g, {
        kind: "harm",
        actor: incident.target,
        source: incident.id,
        label:
          incident.family === "reputation"
            ? "Lost trade opportunity · village penalty"
            : "Deceptive trade · treasury loss",
        delta: { gold: -paid, wood: 0, food: 0 },
        uncovered: expected - paid,
      });
    }
  }
  if (
    after.incidents.length > before.incidents.length ||
    after.status === "completed"
  )
    c.playing = false;
  remember(c, after);
  return g;
}
export function councilCommand(state: Game, command: CouncilCommand): Game {
  if (state.battle)
    throw Error("Return from your raid before managing village life.");
  const g = structuredClone(state);
  g.council ??= newCouncil();
  const c = g.council;
  if (command.type === "pause") {
    c.playing = false;
    c.timer = 0;
  } else if (command.type === "policy") {
    if (c.tick > 0)
      throw Error(
        "This chapter has started. Choose a policy before the next chapter begins.",
      );
    if (!Object.hasOwn(policyInfo, command.policy))
      throw Error("Choose a village policy.");
    c.policy = command.policy;
  } else if (command.type === "next") {
    if (c.tick !== CHAPTER_TICKS)
      throw Error("Finish the current chapter first.");
    if (c.chapter >= chapters.length - 1)
      throw Error("You have completed all four village stories.");
    c.history.push({
      chapter: c.chapter,
      policy: c.policy,
      interventions: structuredClone(c.interventions),
    });
    c.chapter++;
    c.tick = 0;
    c.timer = 0;
    c.playing = false;
    c.interventions = [];
  } else {
    if (c.tick === CHAPTER_TICKS) throw Error("This chapter is complete.");
    if (command.type === "play") c.playing = true;
    else if (command.type === "step") {
      c.playing = false;
      step(g);
    } else if (command.type === "intervene") {
      c.playing = false;
      step(g, command.action);
    }
  }
  return g;
}
// Called only on live game ticks, after normal production. Large/offline advances never simulate unseen social choices.
export function advanceCouncil(g: Game, seconds: number): Game {
  const c = g.council;
  if (
    !c ||
    !c.playing ||
    g.battle ||
    seconds > 1 ||
    seconds <= 0 ||
    !Number.isFinite(seconds)
  )
    return g;
  c.timer += seconds;
  if (c.timer + 1e-8 >= COUNCIL_SECONDS) step(g);
  return g;
}
