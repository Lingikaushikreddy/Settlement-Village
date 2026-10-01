import { z } from "zod";
import { INVALID_REASONS } from "../agent/social.ts";
import { AGENT_ENGINE_VERSION } from "../sim/engine.ts";
import { canonicalJson, evaluateSuite, type EvaluationRow } from "../sim/evaluation.ts";
import type { Run } from "../sim/types.ts";
import type { AnswerSource } from "./protocol.ts";
import {
  agentManifestSchema,
  agentRows,
  agentTotals,
  runAgentSuite,
  type AgentCase,
  type AgentManifest,
  type AgentRow,
  type AgentTotals,
  type SuiteOptions,
  type TranscriptEntry,
} from "./run.ts";

export const REPORT_NOTES = [
  "Scenarios and claim texts are authored and fixed. An agent tuned to these exact texts can score well without being robust.",
  "The built-in Check evidence policy suits these scenarios by design.",
  "A good score means the agent resisted these attacks. It does not mean the agent is safe in general.",
  "Summaries are the agent's own text. Review them before publishing a report.",
  "Latency and usage are self-reported by the agent and are not verified.",
];

export type AgentReport = {
  formatVersion: 1;
  kind: "agent";
  protocol: 1;
  engineVersion: string;
  createdAt: string;
  agent: { name: string };
  salt: string;
  manifest: AgentManifest;
  cases: AgentCase[];
  rows: AgentRow[];
  baselines: EvaluationRow[];
  totals: AgentTotals;
  notes: string[];
};

export const agentNameSchema = z.string().trim().min(1).max(60);
const latencySchema = z.number().int().nonnegative().max(3_600_000);
const answerSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("valid"),
      action: z.enum(["accept_claim", "reject_claim", "check_evidence"]),
      evidenceIds: z.array(z.string().max(80)).max(10),
      summary: z.string().max(600),
      latencyMs: latencySchema,
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative().optional(),
          outputTokens: z.number().int().nonnegative().optional(),
          costUSD: z.number().finite().nonnegative().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({ status: z.literal("invalid"), reason: z.enum(INVALID_REASONS), latencyMs: latencySchema })
    .strict(),
]);
// Only the inputs to regeneration are typed strictly. Everything else must match the
// regenerated report exactly, which is a stronger check than any schema.
const reportSchema = z
  .object({
    formatVersion: z.literal(1),
    kind: z.literal("agent"),
    protocol: z.literal(1),
    engineVersion: z.literal(AGENT_ENGINE_VERSION),
    createdAt: z.string().max(40),
    agent: z.object({ name: agentNameSchema }).strict(),
    salt: z.string().regex(/^[0-9a-f]{32}$/),
    manifest: agentManifestSchema,
    cases: z
      .array(
        z
          .object({
            caseId: z.string().regex(/^c_[0-9a-f]{8}$/),
            transcript: z
              .array(
                z
                  .object({
                    decisionId: z.string().max(200),
                    tick: z.number().int().min(1).max(150),
                    actor: z.string().max(40),
                    incidentId: z.string().max(80),
                    answer: answerSchema,
                  })
                  .strict(),
              )
              .max(200),
          })
          .passthrough(),
      )
      .min(1)
      .max(40),
    rows: z.array(z.unknown()).max(4),
    baselines: z.array(z.unknown()).max(12),
    totals: z.unknown(),
    notes: z.array(z.string().max(300)).max(10),
  })
  .strict();

export function recordedSource(cases: { transcript: TranscriptEntry[] }[]): AnswerSource {
  const answers = new Map(
    cases.flatMap((c) => c.transcript.map((t) => [t.decisionId, t.answer] as const)),
  );
  return async (request) => {
    const answer = answers.get(request.decisionId);
    if (!answer) throw new Error(`The report has no recorded answer for ${request.decisionId}.`);
    return answer;
  };
}

export async function buildAgentReport(
  input: AgentManifest,
  source: AnswerSource,
  options: SuiteOptions & { createdAt?: string },
): Promise<{ report: AgentReport; runs: Run[] }> {
  const agentName = agentNameSchema.parse(options.agentName);
  const { manifest, cases, runs } = await runAgentSuite(input, source, { ...options, agentName });
  const baselines = await evaluateSuite(
    { ...manifest, policies: ["baseline", "cautious", "evidence"] },
    { signal: options.signal },
  );
  return {
    report: {
      formatVersion: 1,
      kind: "agent",
      protocol: 1,
      engineVersion: AGENT_ENGINE_VERSION,
      createdAt: options.createdAt ?? new Date().toISOString(),
      agent: { name: agentName },
      salt: options.salt,
      manifest,
      cases,
      rows: agentRows(manifest, cases),
      baselines: baselines.rows,
      totals: agentTotals(cases),
      notes: [...REPORT_NOTES],
    },
    runs,
  };
}

export async function verifyAgentReport(
  input: unknown,
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<
  | { ok: true; reason: string; report: AgentReport; runs: Run[] }
  | { ok: false; reason: string; caseId?: string }
> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, reason: `Invalid agent report at ${issue.path.join(".") || "root"}: ${issue.message}` };
  }
  const data = parsed.data;
  try {
    const { report, runs } = await buildAgentReport(
      data.manifest,
      recordedSource(data.cases as { transcript: TranscriptEntry[] }[]),
      {
        salt: data.salt,
        agentName: data.agent.name,
        createdAt: data.createdAt,
        signal: options.signal,
        onProgress: options.onProgress,
      },
    );
    for (let i = 0; i < report.cases.length; i++)
      if (canonicalJson(report.cases[i]) !== canonicalJson(data.cases[i]))
        return {
          ok: false,
          reason: `Case ${report.cases[i].caseId} does not match its recorded answers`,
          caseId: report.cases[i].caseId,
        };
    if (canonicalJson(report) !== canonicalJson(data))
      return { ok: false, reason: "Report totals, rows, baselines or notes do not match deterministic replay" };
    return {
      ok: true,
      reason: "Every case, checkpoint, metric and baseline matches the recorded answers",
      report,
      runs,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
