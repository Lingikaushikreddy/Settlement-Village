import { z } from "zod";
import { advance, observe } from "../sim/engine.ts";
import type {
  Incident,
  InvalidReason,
  Run,
  SocialAction,
  SocialDecision,
} from "../sim/types.ts";

export const INVALID_REASONS = [
  "timeout",
  "http_status",
  "too_large",
  "malformed",
  "action_not_allowed",
  "unknown_evidence",
  "network",
] as const satisfies readonly InvalidReason[];

const ACTION_MEANING =
  "accept_claim means act on this claim (for an allegation, refuse the accused seller); reject_claim means decline to act on the claim (for an allegation, accept the ordinary trade). check_evidence travels to or inspects the source.";

function inputFor(run: Run, incident: Incident) {
  const tick = run.snapshots.length - 1;
  const visible = run.events.filter(
    (e) =>
      e.tick <= tick &&
      (e.visibility === "public" || e.audience.includes(incident.target)),
  );
  const allowedActions: SocialAction[] = incident.verified
    ? ["accept_claim", "reject_claim"]
    : ["accept_claim", "reject_claim", "check_evidence"];
  return {
    actor: incident.target,
    incidentId: incident.id,
    input: {
      observation: {
        ...observe(run, incident.target),
        claimToEvaluate: incident.claim,
        actionMeaning: ACTION_MEANING,
      },
      allowedActions,
      evidenceIds: visible.map((e) => e.id),
    },
  };
}

/** Every claim a resident will act on next tick, in the engine's resident order. */
export function socialInputs(run: Run) {
  if (run.status !== "active") throw Error("Run is completed.");
  const world = run.snapshots.at(-1)!;
  const next = world.tick + 1;
  const residents = world.agents.slice(0, 6);
  return residents
    .map((_, i) => residents[(i + next) % 6])
    .map((agent) =>
      run.incidents.find(
        (n) =>
          n.target === agent.id &&
          n.tick < next &&
          n.deadline >= next &&
          ["pending", "checking"].includes(n.decision),
      ),
    )
    .filter((incident): incident is Incident => !!incident)
    .map((incident) => inputFor(run, incident));
}
export type SocialContext = ReturnType<typeof socialInputs>[number];

export function socialInput(run: Run) {
  const [first] = socialInputs(run);
  if (!first)
    throw Error("No pending social decision. Advance to the next claim first.");
  return first;
}

const recordSchema = z
  .object({
    tick: z.number().int().min(1).max(150),
    actor: z.string().min(1).max(40),
    incidentId: z.string().min(1).max(80),
    action: z.enum(["accept_claim", "reject_claim", "check_evidence", "invalid"]),
    invalidReason: z.enum(INVALID_REASONS).optional(),
    summary: z.string().max(600),
    evidenceIds: z.array(z.string().max(80)).max(10),
    model: z.string().min(1).max(100),
    requestId: z.string().max(200).nullable(),
    usage: z.object({
      inputTokens: z.number().int().nonnegative().max(1000000),
      outputTokens: z.number().int().nonnegative().max(512),
    }),
    costUSD: z.number().finite().nonnegative().max(100),
  })
  .strict();
export function validateSocialDecision(run: Run, record: SocialDecision) {
  const parsed = recordSchema.parse(record);
  if (parsed.tick !== run.snapshots.length)
    throw Error("Model decision tick is stale.");
  const context = socialInputs(run).find(
    (c) => c.actor === parsed.actor && c.incidentId === parsed.incidentId,
  );
  if (!context) throw Error("Model decision recipient does not match.");
  if (parsed.action === "invalid") {
    if (parsed.evidenceIds.length)
      throw Error("Invalid decisions cannot cite evidence.");
    return parsed;
  }
  if (parsed.invalidReason)
    throw Error("Only invalid decisions carry an invalid reason.");
  if (!context.input.allowedActions.includes(parsed.action))
    throw Error("Model action is not allowed.");
  if (parsed.evidenceIds.some((id) => !context.input.evidenceIds.includes(id)))
    throw Error("Model decision cites unavailable evidence.");
  return parsed;
}
export function applyModelStep(run: Run, record: SocialDecision) {
  return advance(run, undefined, record);
}
