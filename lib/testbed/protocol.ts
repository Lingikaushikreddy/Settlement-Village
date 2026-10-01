import { z } from "zod";
import type { SocialContext } from "../agent/social.ts";
import type {
  InvalidReason,
  Run,
  SocialAction,
  SocialDecision,
} from "../sim/types.ts";

export const PROTOCOL = 1;
export const MAX_SUMMARY = 600;
/** The engine's own goal text can reveal an honest offer, so requests use a neutral one. */
export const NEUTRAL_GOAL = "Decide how to respond to a claim";

export type DecisionRequest = {
  protocol: 1;
  caseId: string;
  decisionId: string;
  tick: number;
  you: { id: string; name: string; occupation: string };
  observation: Record<string, unknown>;
  claim: string;
  actionMeaning: string;
  allowedActions: SocialAction[];
  evidenceIds: string[];
};
export type Usage = { inputTokens?: number; outputTokens?: number; costUSD?: number };
export type AgentAnswer =
  | {
      status: "valid";
      action: SocialAction;
      evidenceIds: string[];
      summary: string;
      latencyMs: number;
      usage?: Usage;
    }
  | { status: "invalid"; reason: InvalidReason; latencyMs: number };
export type AnswerSource = (request: DecisionRequest) => Promise<AgentAnswer>;

export function buildRequest(
  run: Run,
  caseId: string,
  context: SocialContext,
): DecisionRequest {
  const self = run.snapshots.at(-1)!.agents.find((a) => a.id === context.actor)!;
  const { claimToEvaluate, actionMeaning, ...observation } = context.input.observation;
  return {
    protocol: PROTOCOL,
    caseId,
    decisionId: `${caseId}:t${run.snapshots.length}:${context.actor}`,
    tick: observation.tick,
    you: { id: self.id, name: self.name, occupation: self.occupation },
    observation: { ...observation, self: { ...observation.self, goal: NEUTRAL_GOAL } },
    claim: claimToEvaluate,
    actionMeaning,
    allowedActions: [...context.input.allowedActions],
    evidenceIds: [...context.input.evidenceIds],
  };
}

const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  outputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  costUSD: z.number().finite().nonnegative().max(1000).optional(),
});
// Unknown fields are stripped, not rejected, so agents can return extra reasoning.
const responseSchema = z.object({
  action: z.string().max(40),
  evidenceIds: z.array(z.string().max(80)).max(10).default([]),
  summary: z.string().max(100_000).default(""),
  usage: usageSchema.optional(),
});

export function parseAgentResponse(
  body: string,
  request: Pick<DecisionRequest, "allowedActions" | "evidenceIds">,
  latencyMs: number,
): AgentAnswer {
  const invalid = (reason: InvalidReason): AgentAnswer => ({ status: "invalid", reason, latencyMs });
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return invalid("malformed");
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return invalid("malformed");
  const action = parsed.data.action as SocialAction;
  if (!request.allowedActions.includes(action)) return invalid("action_not_allowed");
  const evidenceIds = [...new Set(parsed.data.evidenceIds)];
  if (evidenceIds.some((id) => !request.evidenceIds.includes(id)))
    return invalid("unknown_evidence");
  const text = parsed.data.summary;
  const summary = text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text;
  const usage = parsed.data.usage;
  return {
    status: "valid",
    action,
    evidenceIds,
    summary,
    latencyMs,
    ...(usage && Object.keys(usage).length ? { usage } : {}),
  };
}

/** Engine record for one answer. Usage stays in the transcript; the engine records zero cost. */
export function toSocialDecision(
  run: Run,
  context: SocialContext,
  request: DecisionRequest,
  answer: AgentAnswer,
  agentName: string,
): SocialDecision {
  const base = {
    tick: run.snapshots.length,
    actor: context.actor,
    incidentId: context.incidentId,
    model: agentName,
    requestId: request.decisionId,
    usage: { inputTokens: 0, outputTokens: 0 },
    costUSD: 0,
  };
  return answer.status === "valid"
    ? { ...base, action: answer.action, summary: answer.summary, evidenceIds: answer.evidenceIds }
    : { ...base, action: "invalid", invalidReason: answer.reason, summary: "", evidenceIds: [] };
}
