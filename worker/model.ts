import { proposeWithClaude } from "../lib/agent/claude.ts";
import { socialInput, applyModelStep } from "../lib/agent/social.ts";
import type { SocialDecision } from "../lib/sim/types.ts";
import type { RunStore } from "./store.ts";
export type ModelConfig = {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  inputPrice: number;
  outputPrice: number;
  dailyBudget: number;
};
export function modelConfig(env: NodeJS.ProcessEnv): ModelConfig {
  return {
    enabled: env.SETTLEMENT_LIVE_AI === "true",
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.SETTLEMENT_CLAUDE_MODEL,
    inputPrice: Number(env.SETTLEMENT_CLAUDE_INPUT_USD_PER_MTOK),
    outputPrice: Number(env.SETTLEMENT_CLAUDE_OUTPUT_USD_PER_MTOK),
    dailyBudget: Number(env.SETTLEMENT_AI_DAILY_BUDGET_USD || "1"),
  };
}
export function modelStatus(config: ModelConfig) {
  const ready =
    config.enabled &&
    !!config.apiKey &&
    !!config.model &&
    [config.inputPrice, config.outputPrice, config.dailyBudget].every(
      (n) => Number.isFinite(n) && n > 0,
    );
  return {
    ready,
    enabled: config.enabled,
    model: config.model ?? null,
    maxCallsPerRun: 6,
    maxDailyCalls: 20,
    dailyBudgetUSD: Number.isFinite(config.dailyBudget)
      ? config.dailyBudget
      : null,
    reason: !config.enabled
      ? "Live models are disabled. Free resident policies are available."
      : !ready
        ? "Configure the server API key, model, token prices and daily budget."
        : "Ready for explicit model steps on paused worker experiments.",
  };
}
export async function modelStep(
  store: RunStore,
  runId: string,
  command: { id: string; expectedVersion: number },
  config: ModelConfig,
  transport: typeof fetch = fetch,
) {
  const status = modelStatus(config);
  if (!status.ready) throw Error(status.reason);
  const prior = store.modelReceipt(runId, command);
  if (prior) return prior;
  const current = store.get(runId);
  const context = socialInput(current.run);
  // Conservative input reservation: one token per UTF-8 byte plus prompt/tool overhead.
  const maxInput =
    Buffer.byteLength(JSON.stringify(context.input), "utf8") + 4000;
  const reserve =
    (maxInput * config.inputPrice + 256 * config.outputPrice) / 1e6;
  store.reserveModel(runId, command, reserve, config.dailyBudget);
  try {
    const response = await proposeWithClaude(
      context.input,
      {
        enabled: true,
        apiKey: config.apiKey,
        model: config.model,
        remainingCalls: 1,
        maxOutputTokens: 256,
      },
      transport,
    );
    store.recordModelResponse(runId, command.id, response);
    if (!response.ok)
      throw Error(
        `Model request failed: ${response.reason}. No world action was applied.`,
      );
    const costUSD =
      (response.usage.inputTokens * config.inputPrice +
        response.usage.outputTokens * config.outputPrice) /
      1e6;
    const decision: SocialDecision = {
      tick: current.run.snapshots.length,
      actor: context.actor,
      incidentId: context.incidentId,
      action: response.proposal.action as SocialDecision["action"],
      summary: response.proposal.summary,
      evidenceIds: response.proposal.evidenceIds,
      model: config.model!,
      requestId: response.requestId,
      usage: response.usage,
      costUSD,
    };
    const next = applyModelStep(current.run, decision);
    return store.commitModel(runId, command, next, costUSD);
  } catch (error) {
    store.failModel(
      runId,
      command.id,
      error instanceof Error ? error.message : "Model request failed",
    );
    throw error;
  }
}
