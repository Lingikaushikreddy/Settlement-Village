import { z } from "zod";
import type { Resources, Resource, TroopKind } from "./model.ts";
export type ObjectiveKind = "raid" | "stockpile";
export type CrewCommand =
  | { type: "start"; kind: ObjectiveKind }
  | { type: "pause" | "resume" | "cancel" }
  | { type: "rest"; id: string };
export type CrewAgent = {
  id: string;
  x: number;
  y: number;
  task: string | null;
  status: "idle" | "moving" | "working" | "resting" | "waiting";
  restUntil: number;
  experience: number;
  completed: number;
  reason: string;
  plan: string[];
  memories: { tick: number; text: string }[];
};
export type CrewTask = {
  id: string;
  kind: "collect" | "train";
  buildingId: string;
  troop?: TroopKind;
  count: number;
  resource?: Resource;
  priority: number;
  label: string;
  reason: string;
  blocked: string | null;
  assignee: string | null;
  work: number;
};
export type CrewEvent = {
  id: string;
  tick: number;
  actor: string;
  type: "objective" | "claim" | "action" | "adapt" | "complete";
  text: string;
};
export type CrewState = {
  version: 1;
  tick: number;
  timer: number;
  playing: boolean;
  status: "idle" | "active" | "complete";
  objective: {
    kind: ObjectiveKind;
    startedTick: number;
    targetArmy: number;
    reserves: Resources;
    budget: Resources;
    spent: Resources;
  } | null;
  agents: CrewAgent[];
  tasks: CrewTask[];
  events: CrewEvent[];
};
export const crewIds = [
  "mira",
  "theo",
  "ada",
  "finn",
  "lina",
  "oscar",
] as const;
const number = z.number().finite().nonnegative();
const integer = number.int().max(Number.MAX_SAFE_INTEGER);
const text = z.string().max(300);
const resources = z.object({ gold: number, wood: number, food: number });
const id = z.string().min(1).max(100);
export const crewSchema = z
  .object({
    version: z.literal(1),
    tick: integer,
    timer: number.lt(1),
    playing: z.boolean(),
    status: z.enum(["idle", "active", "complete"]),
    objective: z
      .object({
        kind: z.enum(["raid", "stockpile"]),
        startedTick: integer,
        targetArmy: integer.max(40),
        reserves: resources,
        budget: resources,
        spent: resources,
      })
      .nullable(),
    agents: z
      .array(
        z.object({
          id: z.enum(crewIds),
          x: integer.max(8),
          y: integer.max(8),
          task: id.nullable(),
          status: z.enum(["idle", "moving", "working", "resting", "waiting"]),
          restUntil: integer,
          experience: integer.max(100),
          completed: integer.max(1000000),
          reason: text,
          plan: z.array(text).max(8),
          memories: z.array(z.object({ tick: integer, text })).max(12),
        }),
      )
      .length(6),
    tasks: z
      .array(
        z.object({
          id,
          kind: z.enum(["collect", "train"]),
          buildingId: id,
          troop: z.enum(["knight", "archer", "catapult"]).optional(),
          count: integer.min(1).max(5),
          resource: z.enum(["gold", "wood", "food"]).optional(),
          priority: number.max(1000),
          label: text,
          reason: text,
          blocked: text.nullable(),
          assignee: z.enum(crewIds).nullable(),
          work: integer.max(2),
        }),
      )
      .max(40),
    events: z
      .array(
        z.object({
          id,
          tick: integer,
          actor: z.string().max(40),
          type: z.enum(["objective", "claim", "action", "adapt", "complete"]),
          text,
        }),
      )
      .max(120),
  })
  .superRefine((c, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid crew state or exclusive task claims.",
      });
    if (
      new Set(c.agents.map((a) => a.id)).size !== 6 ||
      new Set(c.tasks.map((t) => t.id)).size !== c.tasks.length ||
      new Set(c.events.map((e) => e.id)).size !== c.events.length
    )
      fail();
    if (
      (c.status === "idle") !== (c.objective === null) ||
      (c.playing && c.status !== "active") ||
      (c.status !== "active" && c.tasks.length)
    )
      fail();
    if (
      c.objective &&
      (c.objective.startedTick > c.tick ||
        (["gold", "wood", "food"] as const).some(
          (r) => c.objective!.spent[r] > c.objective!.budget[r],
        ))
    )
      fail();
    if (
      c.events.some((e) => e.tick > c.tick) ||
      c.agents.some((a) => a.memories.some((m) => m.tick > c.tick))
    )
      fail();
    for (const a of c.agents)
      if (
        a.task &&
        !c.tasks.some((t) => t.id === a.task && t.assignee === a.id)
      )
        fail();
    const workplaces = new Set<string>();
    for (const t of c.tasks) {
      if (
        t.assignee &&
        !c.agents.some((a) => a.id === t.assignee && a.task === t.id)
      )
        fail();
      if (
        (t.kind === "train" && !t.troop) ||
        (t.kind === "collect" && !t.resource)
      )
        fail();
      const key =
        t.kind === "collect" ? `collect:${t.buildingId}` : `train:${t.troop}`;
      if (workplaces.has(key)) fail();
      workplaces.add(key);
    }
  });
