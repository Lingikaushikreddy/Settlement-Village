import { z } from "zod";
import type { Game } from "./model.ts";
const number = z.number().finite().nonnegative().max(1e12);
const integer = number.int();
const kind = z.enum(["hall", "mine", "mill", "farm", "barracks", "tower"]);
const troop = z.enum(["knight", "archer", "catapult"]);
const id = z.string().min(1).max(80);
const xy = z.number().finite().min(-1).max(10);
const tile = z.number().int().min(0).max(8);
const resources = z.object({ gold: number, wood: number, food: number });
const schema = z.object({
  version: z.literal(2),
  clock: number,
  serial: integer,
  resources,
  buildings: z
    .array(
      z.object({
        id,
        kind,
        x: tile,
        y: tile,
        level: z.number().int().min(1).max(5),
        stored: number,
        readyAt: number.optional(),
        constructing: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(30),
  army: z.object({
    knight: integer.max(40),
    archer: integer.max(40),
    catapult: integer.max(40),
  }),
  training: z.array(z.object({ kind: troop, readyAt: number })).max(40),
  trophies: integer,
  unlocked: z.number().int().min(0).max(2),
  stats: z.object({
    collected: number,
    built: integer,
    upgraded: integer,
    wins: integer,
  }),
  claimed: z.array(z.enum(["gather", "build", "upgrade", "raid"])).max(4),
  battle: z
    .object({
      level: z.number().int().min(0).max(2),
      elapsed: number.max(91),
      deployed: integer.max(40),
      focus: id.optional(),
      settled: z.boolean().optional(),
      units: z
        .array(
          z.object({
            id,
            kind: troop,
            x: xy,
            y: xy,
            hp: number,
            maxHp: number.positive(),
            target: id.optional(),
            attacking: z.boolean().optional(),
          }),
        )
        .max(40),
      buildings: z
        .array(
          z.object({
            id,
            kind,
            x: tile,
            y: tile,
            hp: number,
            maxHp: number.positive(),
          }),
        )
        .min(1)
        .max(9),
      result: z
        .object({
          stars: z.number().int().min(0).max(3),
          destruction: number.max(100),
          gold: integer,
          wood: integer,
          food: integer,
        })
        .optional(),
    })
    .optional(),
});
export function parseSave(raw: string): Game {
  try {
    const g = schema.parse(JSON.parse(raw));
    if (
      g.buildings.filter((b) => b.kind === "hall").length !== 1 ||
      new Set(g.buildings.map((b) => `${b.x},${b.y}`)).size !==
        g.buildings.length ||
      new Set(g.buildings.map((b) => b.id)).size !== g.buildings.length
    )
      throw Error();
    if (
      Object.values(g.army).reduce((a, b) => a + b, 0) + g.training.length >
      40
    )
      throw Error();
    if (
      g.battle &&
      (g.battle.buildings.filter((b) => b.kind === "hall").length !== 1 ||
        g.battle.units.some((u) => u.hp > u.maxHp) ||
        g.battle.buildings.some((b) => b.hp > b.maxHp))
    )
      throw Error();
    return g;
  } catch {
    throw Error("This save is damaged or belongs to another version.");
  }
}
