import { z } from "zod";
import { socialInputs } from "../agent/social.ts";
import { advance, checkInvariants, createRun, definitionFor, verifyReplay } from "../sim/engine.ts";
import {
  MAX_AGENT_SCENARIOS,
  caseRecord,
  orderScenarios,
  seedSchema,
  summarizeRow,
  tickSchema,
  unique,
  type EvaluationCase,
  type EvaluationRow,
} from "../sim/evaluation.ts";
import {
  createRegistry,
  defaultRegistry,
  isBuiltIn,
  scenarioDefinitionSchema,
  type ScenarioDefinition,
  type ScenarioRegistry,
} from "../sim/scenarios/index.ts";
import type { Config, Run, SocialDecision } from "../sim/types.ts";
import { caseIdFor } from "./case-id.ts";
import {
  buildRequest,
  toSocialDecision,
  type AgentAnswer,
  type AnswerSource,
} from "./protocol.ts";

export type AgentManifest = {
  scenarios: string[];
  seeds: number[];
  maxTicks: number;
  /** Every non-built-in definition the report uses, in id order. Absent for built-in-only reports. */
  definitions?: ScenarioDefinition[];
};
export type TranscriptEntry = {
  decisionId: string;
  tick: number;
  actor: string;
  incidentId: string;
  answer: AgentAnswer;
};
export type HonestCounts = { offers: number; accepted: number; refused: number; unanswered: number };
export type AgentCase = Omit<EvaluationCase, "config"> & {
  config: Config & { policy: "external" };
  caseId: string;
  honest: HonestCounts;
  transcript: TranscriptEntry[];
};
export type AgentRow = Omit<EvaluationRow, "policy"> & {
  policy: "external";
  honestAccepted: number;
  honestUnanswered: number;
  /** (refused + unanswered) / honest offers: silence is not credited as acceptance. */
  honestRefusalRate: number | null;
  decisions: number;
  invalidDecisions: number;
  invalidRate: number | null;
};
export type AgentTotals = {
  decisions: number;
  invalid: number;
  selfReportedCostUSD: number;
  meanLatencyMs: number;
};
export type SuiteOptions = {
  salt: string;
  agentName: string;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  /** Resolves scenario ids; defaults to a registry built from the manifest's definitions. */
  registry?: ScenarioRegistry;
};

export const agentManifestSchema = z
  .object({
    scenarios: z
      .array(z.string().regex(/^[a-z][a-z0-9-]{1,39}$/))
      .min(1)
      .max(MAX_AGENT_SCENARIOS)
      .refine(unique, "Scenarios must be unique"),
    seeds: z.array(seedSchema).min(1).max(10).refine(unique, "Seeds must be unique"),
    maxTicks: tickSchema,
    definitions: z.array(scenarioDefinitionSchema).max(MAX_AGENT_SCENARIOS).optional(),
  })
  .strict();

/** Canonical order: built-ins in engine order, then custom ids alphabetically. Every id must resolve. */
export function normalizeAgentManifest(
  input: AgentManifest,
  registry: ScenarioRegistry = defaultRegistry,
): AgentManifest {
  const parsed = agentManifestSchema.parse(input);
  for (const id of parsed.scenarios)
    if (!registry.has(id))
      throw new Error(
        `Unknown scenario "${id}". Custom scenarios need a definition (--scenario-file or manifest.definitions).`,
      );
  const scenarios = orderScenarios(parsed.scenarios);
  const definitions = scenarios.filter((s) => !isBuiltIn(s)).map((id) => registry.get(id)!);
  return {
    scenarios,
    seeds: [...parsed.seeds].sort((a, b) => a - b),
    maxTicks: parsed.maxTicks,
    ...(definitions.length ? { definitions } : {}),
  };
}

/** The registry a manifest implies: built-ins plus its own definitions. */
export function registryFor(manifest: Pick<AgentManifest, "definitions">): ScenarioRegistry {
  return createRegistry(manifest.definitions ?? []);
}

const cancelled = () => new DOMException("Evaluation cancelled", "AbortError");

export function honestCounts(run: Run): HonestCounts {
  const last = run.snapshots.length - 1;
  const offers = definitionFor(run).kind === "honest" ? run.incidents : [];
  return {
    offers: offers.length,
    accepted: offers.filter((i) => i.decision === "accepted").length,
    refused: offers.filter((i) => i.decision === "refused").length,
    unanswered: offers.filter(
      (i) => ["pending", "checking"].includes(i.decision) && i.deadline <= last,
    ).length,
  };
}

export async function runAgentCase(
  config: { scenario: string; seed: number; maxTicks: number },
  caseId: string,
  source: AnswerSource,
  agentName: string,
  signal?: AbortSignal,
  definition?: ScenarioDefinition,
) {
  let run = createRun({ ...config, policy: "external" }, definition);
  const transcript: TranscriptEntry[] = [];
  while (run.status === "active") {
    if (signal?.aborted) throw cancelled();
    const pending = socialInputs(run);
    if (pending.length > 1)
      throw new Error(
        `Case ${caseId} has ${pending.length} claims pending at once; protocol 1 supports one decision per tick.`,
      );
    let decision: SocialDecision | undefined;
    if (pending.length === 1) {
      const request = buildRequest(run, caseId, pending[0]);
      const answer = await source(request);
      transcript.push({
        decisionId: request.decisionId,
        tick: run.snapshots.length,
        actor: pending[0].actor,
        incidentId: pending[0].incidentId,
        answer,
      });
      decision = toSocialDecision(run, pending[0], request, answer, agentName);
    }
    run = advance(run, undefined, decision);
  }
  const issues = checkInvariants(run);
  const replay = verifyReplay(run);
  if (issues.length || !replay.ok)
    throw new Error(`Invalid agent run ${caseId}: ${issues.join("; ") || replay.reason}`);
  return { run, transcript };
}

export async function runAgentSuite(
  input: AgentManifest,
  source: AnswerSource,
  options: SuiteOptions,
) {
  const registry = options.registry ?? registryFor(input);
  const manifest = normalizeAgentManifest(input, registry);
  const jobs = manifest.scenarios.flatMap((scenario) =>
    manifest.seeds.map((seed) => ({ scenario, seed })),
  );
  const cases: AgentCase[] = new Array(jobs.length);
  const runs: Run[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  let failed = false;
  options.onProgress?.(0, jobs.length);
  async function worker() {
    while (!failed && next < jobs.length) {
      const index = next++;
      const { scenario, seed } = jobs[index];
      let caseId = `${scenario}/${seed}`;
      try {
        caseId = await caseIdFor(options.salt, scenario, seed);
        const { run, transcript } = await runAgentCase(
          { scenario, seed, maxTicks: manifest.maxTicks },
          caseId,
          source,
          options.agentName,
          options.signal,
          isBuiltIn(scenario) ? undefined : registry.get(scenario),
        );
        cases[index] = {
          ...(caseRecord(run) as Omit<EvaluationCase, "config">),
          config: run.config as AgentCase["config"],
          caseId,
          honest: honestCounts(run),
          transcript,
        };
        runs[index] = run;
        options.onProgress?.(++done, jobs.length);
      } catch (error) {
        failed = true;
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        // Name the case, so a failed verification points at the evidence to inspect.
        throw new Error(
          `Case ${caseId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  const width = Math.max(1, Math.min(options.concurrency ?? 4, jobs.length));
  await Promise.all(Array.from({ length: width }, worker));
  return { manifest, cases, runs };
}

export function agentRows(manifest: AgentManifest, cases: AgentCase[]): AgentRow[] {
  return manifest.scenarios.map((scenario) => {
    const selected = cases.filter((c) => c.config.scenario === scenario);
    const sum = (pick: (c: AgentCase) => number) => selected.reduce((n, c) => n + pick(c), 0);
    const offers = sum((c) => c.honest.offers);
    const refused = sum((c) => c.honest.refused);
    const unanswered = sum((c) => c.honest.unanswered);
    const decisions = sum((c) => c.transcript.length);
    const invalid = sum((c) => c.transcript.filter((t) => t.answer.status === "invalid").length);
    return {
      ...summarizeRow(scenario, "external" as const, selected),
      honestAccepted: sum((c) => c.honest.accepted),
      honestUnanswered: unanswered,
      honestRefusalRate: offers ? (refused + unanswered) / offers : null,
      decisions,
      invalidDecisions: invalid,
      invalidRate: decisions ? invalid / decisions : null,
    };
  });
}

export function agentTotals(cases: AgentCase[]): AgentTotals {
  const entries = cases.flatMap((c) => c.transcript);
  const cost = entries.reduce(
    (n, e) => n + (e.answer.status === "valid" ? (e.answer.usage?.costUSD ?? 0) : 0),
    0,
  );
  const latency = entries.reduce((n, e) => n + e.answer.latencyMs, 0);
  return {
    decisions: entries.length,
    invalid: entries.filter((e) => e.answer.status === "invalid").length,
    selfReportedCostUSD: Math.round(cost * 1e6) / 1e6,
    meanLatencyMs: entries.length ? Math.round(latency / entries.length) : 0,
  };
}
