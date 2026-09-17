import { z } from "zod";
import {
  ENGINE_VERSION,
  checkInvariants,
  checksum,
  metrics,
  runToEnd,
  verifyReplay,
} from "./engine.ts";
import type { Config, Policy, Scenario } from "./types.ts";

const SCENARIOS = ["scarcity", "reputation", "injection", "benign"] as const;
const POLICIES = ["baseline", "cautious", "evidence"] as const;
const scenarioSchema = z.enum(SCENARIOS);
const policySchema = z.enum(POLICIES);
const seedSchema = z.number().int().min(0).max(999999);
const tickSchema = z.number().int().min(20).max(150);
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hashSchema = z.string().regex(/^[0-9a-f]{8}$/);
const unique = (values: unknown[]) => new Set(values).size === values.length;

const manifestSchema = z
  .object({
    scenarios: z
      .array(scenarioSchema)
      .min(1)
      .max(4)
      .refine(unique, "Scenarios must be unique"),
    policies: z
      .array(policySchema)
      .min(1)
      .max(3)
      .refine(unique, "Policies must be unique"),
    seeds: z
      .array(seedSchema)
      .min(1)
      .max(10)
      .refine(unique, "Seeds must be unique"),
    maxTicks: tickSchema,
  })
  .strict()
  .refine(
    (m) => m.scenarios.length * m.policies.length * m.seeds.length <= 120,
    "Evaluation is limited to 120 cases",
  );

export type EvaluationManifest = {
  scenarios: Scenario[];
  policies: Policy[];
  seeds: number[];
  maxTicks: number;
};
export type EvaluationMetrics = ReturnType<typeof metrics>;
export type EvaluationCase = {
  config: Config;
  metrics: EvaluationMetrics;
  checkpoints: string[];
  evidenceChecksum: string;
  inspectionCount: number;
};
export type EvaluationRow = {
  scenario: Scenario;
  policy: Policy;
  runCount: number;
  attacks: number;
  evaluable: number;
  successes: number;
  resisted: number;
  unresolved: number;
  pending: number;
  harm: number;
  detections: number;
  benignOffers: number;
  benignRefused: number;
  inspectionCount: number;
  /** Fractions in [0, 1]; null means there were no applicable offers. */
  attackSuccessRate: number | null;
  benignRefusalRate: number | null;
};
export type EvaluationReport = {
  formatVersion: 1;
  engineVersion: string;
  manifest: EvaluationManifest;
  cases: EvaluationCase[];
  rows: EvaluationRow[];
  modelCalls: 0;
};
export type EvaluationOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  yieldControl?: () => Promise<void>;
};

const countsShape = {
  attacks: countSchema,
  evaluable: countSchema,
  successes: countSchema,
  resisted: countSchema,
  unresolved: countSchema,
  pending: countSchema,
  harm: countSchema,
  detections: countSchema,
  benignOffers: countSchema,
  benignRefused: countSchema,
};
const configSchema = z
  .object({
    scenario: scenarioSchema,
    policy: policySchema,
    seed: seedSchema,
    maxTicks: tickSchema,
  })
  .strict();
const caseSchema = z
  .object({
    config: configSchema,
    metrics: z
      .object({
        ...countsShape,
        resistance: z.number().int().min(0).max(100).nullable(),
        trades: countSchema,
        needsMet: z.number().int().min(0).max(6),
      })
      .strict(),
    checkpoints: z.array(hashSchema).min(21).max(151),
    evidenceChecksum: hashSchema,
    inspectionCount: countSchema,
  })
  .strict();
const reportSchema = z
  .object({
    formatVersion: z.literal(1),
    engineVersion: z.literal(ENGINE_VERSION),
    manifest: manifestSchema,
    cases: z.array(caseSchema).min(1).max(120),
    rows: z
      .array(
        z
          .object({
            scenario: scenarioSchema,
            policy: policySchema,
            runCount: z.number().int().min(1).max(10),
            ...countsShape,
            inspectionCount: countSchema,
            attackSuccessRate: z.number().min(0).max(1).nullable(),
            benignRefusalRate: z.number().min(0).max(1).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    modelCalls: z.literal(0),
  })
  .strict();

function normalizeManifest(input: EvaluationManifest): EvaluationManifest {
  const parsed = manifestSchema.parse(input);
  return {
    scenarios: SCENARIOS.filter((scenario) =>
      parsed.scenarios.includes(scenario),
    ),
    policies: POLICIES.filter((policy) => parsed.policies.includes(policy)),
    seeds: [...parsed.seeds].sort((a, b) => a - b),
    maxTicks: parsed.maxTicks,
  };
}

export function createEvaluationManifest(
  scenario: Scenario | "all",
  seedStart = 1,
  seedCount = 10,
  maxTicks = 60,
): EvaluationManifest {
  // Validate before allocating the seed range or starting any simulations.
  z.number().int().min(1).max(10).parse(seedCount);
  seedSchema.parse(seedStart);
  if (scenario !== "all") scenarioSchema.parse(scenario);
  return normalizeManifest({
    scenarios:
      scenario === "all"
        ? [...SCENARIOS]
        : scenario === "benign"
          ? ["benign"]
          : [scenario, "benign"],
    policies: [...POLICIES],
    seeds: Array.from({ length: seedCount }, (_, i) => seedStart + i),
    maxTicks,
  });
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Evaluation cancelled", "AbortError");
}

const yieldToBrowser = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

function summarize(
  manifest: EvaluationManifest,
  cases: EvaluationCase[],
): EvaluationRow[] {
  const rows: EvaluationRow[] = [];
  for (const scenario of manifest.scenarios) {
    for (const policy of manifest.policies) {
      const selected = cases.filter(
        (record) =>
          record.config.scenario === scenario &&
          record.config.policy === policy,
      );
      const sum = (key: keyof typeof countsShape) =>
        selected.reduce((total, record) => total + record.metrics[key], 0);
      const evaluable = sum("evaluable");
      const successes = sum("successes");
      const benignOffers = sum("benignOffers");
      const benignRefused = sum("benignRefused");
      rows.push({
        scenario,
        policy,
        runCount: selected.length,
        attacks: sum("attacks"),
        evaluable,
        successes,
        resisted: sum("resisted"),
        unresolved: sum("unresolved"),
        pending: sum("pending"),
        harm: sum("harm"),
        detections: sum("detections"),
        benignOffers,
        benignRefused,
        inspectionCount: selected.reduce(
          (total, record) => total + record.inspectionCount,
          0,
        ),
        attackSuccessRate: evaluable ? successes / evaluable : null,
        benignRefusalRate: benignOffers ? benignRefused / benignOffers : null,
      });
    }
  }
  return rows;
}

/** Runs authored deterministic policies only; no worker or model calls are made. */
export async function evaluateSuite(
  input: EvaluationManifest,
  options: EvaluationOptions = {},
): Promise<EvaluationReport> {
  checkCancelled(options.signal);
  const manifest = normalizeManifest(input);
  const total =
    manifest.scenarios.length *
    manifest.policies.length *
    manifest.seeds.length;
  const cases: EvaluationCase[] = [];
  options.onProgress?.(0, total);
  for (const scenario of manifest.scenarios) {
    for (const policy of manifest.policies) {
      for (const seed of manifest.seeds) {
        checkCancelled(options.signal);
        await (options.yieldControl ?? yieldToBrowser)();
        checkCancelled(options.signal);
        const run = runToEnd({
          scenario,
          policy,
          seed,
          maxTicks: manifest.maxTicks,
        });
        const issues = checkInvariants(run);
        const replay = verifyReplay(run);
        if (issues.length || !replay.ok) {
          throw new Error(
            `Invalid run ${scenario}/${policy}/${seed}: ${issues.join("; ") || replay.reason}`,
          );
        }
        cases.push({
          config: run.config,
          metrics: metrics(run),
          checkpoints: [...run.checksums],
          // Existing engine checksums detect divergence, not malicious forgery.
          // These noncryptographic hashes are not signatures or attestations.
          evidenceChecksum: checksum({
            events: run.events,
            decisions: run.decisions,
            incidents: run.incidents,
            interventions: run.interventions,
          }),
          inspectionCount: run.events.filter(
            (event) => event.type === "inspection",
          ).length,
        });
        options.onProgress?.(cases.length, total);
        checkCancelled(options.signal);
      }
    }
  }
  return {
    formatVersion: 1,
    engineVersion: ENGINE_VERSION,
    manifest,
    cases,
    rows: summarize(manifest, cases),
    modelCalls: 0,
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return item;
  });
}

export async function verifyEvaluationReport(
  input: unknown,
  options: EvaluationOptions = {},
): Promise<{ ok: boolean; reason: string; report?: EvaluationReport }> {
  checkCancelled(options.signal);
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: `Invalid evaluation report at ${issue.path.join(".") || "root"}: ${issue.message}`,
    };
  }
  const { manifest, cases, rows } = parsed.data;
  const expectedCases =
    manifest.scenarios.length *
    manifest.policies.length *
    manifest.seeds.length;
  if (
    cases.length !== expectedCases ||
    rows.length !== manifest.scenarios.length * manifest.policies.length
  ) {
    return {
      ok: false,
      reason: "Report does not contain the complete declared evaluation matrix",
    };
  }
  const regenerated = await evaluateSuite(manifest, options);
  if (canonicalJson(parsed.data) !== canonicalJson(regenerated)) {
    return {
      ok: false,
      reason:
        "Recorded cases, evidence, or aggregate results do not match deterministic replay",
    };
  }
  return {
    ok: true,
    reason:
      "Every case, checkpoint, evidence checksum, and aggregate matches deterministic replay",
    report: regenerated,
  };
}
