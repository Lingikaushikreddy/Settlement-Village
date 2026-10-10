import { z } from "zod";
import type { Inventory, World } from "./types.ts";

export const LOCATIONS = ["farm", "granary", "market", "well", "workshop"] as const;
export const RESOURCES = ["grain", "wood", "water", "coins"] as const;
/** Agents the engine can use as a proposer today: Rook (the chaos actor) and Theo (the honest trader). */
export const PROPOSERS = ["rook", "theo"] as const;
export const AGENT_IDS = ["mira", "theo", "ada", "finn", "lina", "oscar", "rook"] as const;

const amount = z.number().int().min(0).max(1000);
const inventory = z
  .object({ grain: amount.optional(), wood: amount.optional(), water: amount.optional(), coins: amount.optional() })
  .strict()
  .refine((v) => Object.values(v).some((n) => (n ?? 0) > 0), "must transfer something");

const TOKEN = /\{\{stock:([a-z]+):([a-z]+)\}\}/g;

export const scenarioDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(200),
    kind: z.enum(["attack", "honest"]),
    claim: z.string().min(1).max(400),
    claimTitle: z.string().min(1).max(80),
    goal: z.string().min(1).max(80),
    proposer: z.enum(PROPOSERS),
    /** Who voices the claim (the event actor and incident attacker). Built-ins use Rook. */
    claimant: z.enum(AGENT_IDS).default("rook"),
    excludeTargets: z.array(z.enum(AGENT_IDS)).max(5).default([]),
    offer: z.object({ give: inventory, receive: inventory }).strict(),
    acceptMeans: z.enum(["trade_with_proposer", "refuse_proposer"]),
    evidence: z.object({ site: z.enum(LOCATIONS), fact: z.string().min(1).max(300) }).strict(),
    contradiction: z.discriminatedUnion("type", [
      z.object({ type: z.literal("always") }).strict(),
      z.object({ type: z.literal("never") }).strict(),
      z
        .object({
          type: z.literal("stock_above"),
          location: z.enum(LOCATIONS),
          resource: z.enum(RESOURCES),
          threshold: z.number().int().min(0).max(100000),
          honorsPublishedStock: z.boolean(),
        })
        .strict(),
    ]),
    harm: z.discriminatedUnion("type", [
      z.object({ type: z.literal("overpay"), reference: z.number().int().min(0).max(1000) }).strict(),
      z.object({ type: z.literal("lost_trade"), amount: z.number().int().min(1).max(1000) }).strict(),
      z.object({ type: z.literal("none") }).strict(),
    ]),
    summaries: z
      .object({
        accepted: z.string().min(1).max(300),
        refusedByEvidence: z.string().min(1).max(300),
        refusedByTrust: z.string().min(1).max(300),
        actedOnAllegation: z.string().min(1).max(300).optional(),
        declinedAllegation: z.string().min(1).max(300).optional(),
      })
      .strict(),
    resolvesOnDecision: z.boolean().default(false),
  })
  .strict()
  .superRefine((d, ctx) => {
    if ((d.acceptMeans === "refuse_proposer" && d.harm.type === "overpay") ||
        (d.acceptMeans === "trade_with_proposer" && d.harm.type === "lost_trade"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["harm"], message: `harm.type ${d.harm.type} is incompatible with acceptMeans ${d.acceptMeans}` });
    for (const m of d.evidence.fact.matchAll(TOKEN)) {
      if (!(LOCATIONS as readonly string[]).includes(m[1]))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence", "fact"], message: `unknown location ${m[1]} in fact template` });
      if (!(RESOURCES as readonly string[]).includes(m[2]))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence", "fact"], message: `unknown resource ${m[2]} in fact template` });
    }
    if (d.acceptMeans === "refuse_proposer" && (!d.summaries.actedOnAllegation || !d.summaries.declinedAllegation))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["summaries"], message: "refuse_proposer needs summaries.actedOnAllegation and summaries.declinedAllegation" });
    if (!("coins" in d.offer.receive))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["offer", "receive"], message: "receive must include coins (the offer price)" });
  });

export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;

export function parseScenarioDefinition(input: unknown): ScenarioDefinition {
  return scenarioDefinitionSchema.parse(input);
}

/** Replaces {{stock:<location>:<resource>}} with the current stock. Unknown tokens cannot occur: the schema rejects them. */
export function expandFact(fact: string, world: World): string {
  return fact.replace(TOKEN, (_m, location: string, resource: string) => {
    const stock = world.locations.find((l) => l.id === location)?.stock[resource as keyof Inventory] ?? 0;
    return String(stock);
  });
}

export function offerPrice(d: ScenarioDefinition): number {
  return d.offer.receive.coins ?? 0;
}
