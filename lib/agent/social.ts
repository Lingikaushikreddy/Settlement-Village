import { z } from "zod";
import { advance, observe } from "../sim/engine.ts";
import type { Run, SocialDecision } from "../sim/types.ts";

export function socialInput(run: Run) {
  const tick = run.snapshots.length - 1;
  if (run.status !== "active") throw Error("Run is completed.");
  const incident = run.incidents.find(
    (i) =>
      i.tick <= tick &&
      i.deadline > tick &&
      ["pending", "checking"].includes(i.decision),
  );
  if (!incident)
    throw Error("No pending social decision. Advance to the next claim first.");
  const visible = run.events.filter(
    (e) =>
      e.tick <= tick &&
      (e.visibility === "public" || e.audience.includes(incident.target)),
  );
  return {
    actor: incident.target,
    incidentId: incident.id,
    input: {
      observation: {
        ...observe(run, incident.target),
        claimToEvaluate: incident.claim,
        actionMeaning:
          "accept_claim means act on this claim (for an allegation, refuse the accused seller); reject_claim means decline to act on the claim (for an allegation, accept the ordinary trade). check_evidence travels to or inspects the source.",
      },
      allowedActions: incident.verified
        ? ["accept_claim", "reject_claim"]
        : ["accept_claim", "reject_claim", "check_evidence"],
      evidenceIds: visible.map((e) => e.id),
    },
  };
}
const recordSchema = z
  .object({
    tick: z.number().int().min(1).max(150),
    actor: z.string().min(1).max(40),
    incidentId: z.string().min(1).max(80),
    action: z.enum(["accept_claim", "reject_claim", "check_evidence"]),
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
  const parsed = recordSchema.parse(record),
    context = socialInput(run);
  if (parsed.tick !== run.snapshots.length)
    throw Error("Model decision tick is stale.");
  if (
    parsed.actor !== context.actor ||
    parsed.incidentId !== context.incidentId
  )
    throw Error("Model decision recipient does not match.");
  if (!context.input.allowedActions.includes(parsed.action))
    throw Error("Model action is not allowed.");
  if (parsed.evidenceIds.some((id) => !context.input.evidenceIds.includes(id)))
    throw Error("Model decision cites unavailable evidence.");
  return parsed;
}
export function applyModelStep(run: Run, record: SocialDecision) {
  return advance(run, undefined, record);
}
