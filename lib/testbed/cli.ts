#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { newSalt } from "./case-id.ts";
import { overall, type Overall } from "./evaluate.ts";
import { httpSource } from "./http.ts";
import { agentNameSchema, buildAgentReport, verifyAgentReport, type AgentReport } from "./report.ts";
import { normalizeAgentManifest, type AgentManifest } from "./run.ts";
import type { Scenario } from "../sim/types.ts";

export { overall };

const USAGE = `Usage:
  settlement-testbed --agent <url> [--name <label>] [--out <file>]
      [--scenarios scarcity,reputation,injection,benign] [--seeds 1-10] [--ticks 60]
      [--timeout 30000] [--concurrency 4] [--header "Name: value"]...
      [--max-attack-success 0.1] [--max-honest-refusal 0.2] [--max-invalid 0.05]
  settlement-testbed --verify <report.json>

Guide: https://github.com/Lingikaushikreddy/Settlement-Village/blob/main/docs/agent-testbed.md`;
const MAX_REPORT_BYTES = 5 * 1024 * 1024;
const POLICY_NAMES = { baseline: "Trust first", cautious: "Cautious", evidence: "Check evidence" } as const;

class UsageError extends Error {}

export function parseSeeds(text: string): number[] {
  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range && Number(range[2]) < Number(range[1]))
    throw new UsageError(`--seeds range must go upward (got "${text}")`);
  const seeds = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i)
    : text.split(",").map((s) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN));
  if (!seeds.length || seeds.some((s) => !Number.isInteger(s) || s < 0))
    throw new UsageError(`--seeds must look like 1-10 or 1,4,7 (got "${text}")`);
  return seeds;
}

export function parseHeader(text: string): [string, string] {
  const i = text.indexOf(":");
  if (i < 1) throw new UsageError(`--header must look like "Name: value" (got "${text}")`);
  return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
}

function number(text: string, name: string, min: number, max: number): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new UsageError(`${name} must be between ${min} and ${max} (got "${text}")`);
  return value;
}

const rate = (n: number, d: number) => (d ? `${n}/${d} (${((100 * n) / d).toFixed(1)}%)` : "n/a");

function invalidReasons(report: AgentReport, scenario: string) {
  const counts: Record<string, number> = {};
  for (const c of report.cases)
    if (c.config.scenario === scenario)
      for (const { answer } of c.transcript)
        if (answer.status === "invalid") counts[answer.reason] = (counts[answer.reason] ?? 0) + 1;
  const parts = Object.entries(counts).map(([reason, n]) => `${reason} ${n}`);
  return parts.length ? ` [${parts.join(", ")}]` : "";
}

export function formatSummary(report: AgentReport): string {
  const lines: string[] = [];
  for (const row of report.rows) {
    lines.push(`\n${row.scenario} (${row.runCount} runs)`);
    const attacks = row.evaluable
      ? `attacks succeeded ${rate(row.successes, row.evaluable)}, resisted ${row.resisted}/${row.evaluable}, unresolved ${row.unresolved}/${row.evaluable}`
      : "attacks n/a";
    lines.push(
      `  ${report.agent.name.padEnd(16)} ${attacks}  ·  honest offers refused or unanswered ${rate(row.benignRefused + row.honestUnanswered, row.benignOffers)}  ·  invalid answers ${rate(row.invalidDecisions, row.decisions)}${invalidReasons(report, row.scenario)}`,
    );
    for (const base of report.baselines.filter((b) => b.scenario === row.scenario))
      lines.push(
        `  ${POLICY_NAMES[base.policy].padEnd(16)} attacks succeeded ${rate(base.successes, base.evaluable)}  ·  honest offers refused ${rate(base.benignRefused, base.benignOffers)}`,
      );
  }
  lines.push("", ...report.notes.map((note) => `Note: ${note}`));
  return lines.join("\n");
}

async function verify(path: string): Promise<number> {
  if (statSync(path).size > MAX_REPORT_BYTES) throw new UsageError("Agent reports must be at most 5 MB.");
  const result = await verifyAgentReport(JSON.parse(readFileSync(path, "utf8")));
  if (!result.ok) {
    console.error(`Verification failed: ${result.reason}`);
    return 1;
  }
  console.log(formatSummary(result.report));
  console.log(`\nVerified ${result.report.cases.length} cases. ${result.reason}.`);
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      agent: { type: "string" }, name: { type: "string" }, out: { type: "string" },
      scenarios: { type: "string" }, seeds: { type: "string" }, ticks: { type: "string" },
      timeout: { type: "string" }, concurrency: { type: "string" },
      header: { type: "string", multiple: true },
      "max-attack-success": { type: "string" }, "max-honest-refusal": { type: "string" },
      "max-invalid": { type: "string" }, verify: { type: "string" }, help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.verify) return verify(values.verify);
  if (!values.agent) throw new UsageError("--agent <url> is required.");
  let url: URL;
  try {
    url = new URL(values.agent);
  } catch {
    throw new UsageError(`--agent must be an http(s) URL (got "${values.agent}")`);
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new UsageError(`--agent must be an http(s) URL (got "${values.agent}")`);

  const manifest: AgentManifest = {
    scenarios: (values.scenarios ? values.scenarios.split(",").map((s) => s.trim()) : ["scarcity", "reputation", "injection", "benign"]) as Scenario[],
    seeds: values.seeds ? parseSeeds(values.seeds) : Array.from({ length: 10 }, (_, i) => i + 1),
    maxTicks: values.ticks ? number(values.ticks, "--ticks", 20, 150) : 60,
  };
  const timeoutMs = values.timeout ? number(values.timeout, "--timeout", 100, 600_000) : 30_000;
  const concurrency = values.concurrency ? number(values.concurrency, "--concurrency", 1, 16) : 4;
  const limits = {
    attackSuccess: values["max-attack-success"] !== undefined ? number(values["max-attack-success"], "--max-attack-success", 0, 1) : undefined,
    honestRefusal: values["max-honest-refusal"] !== undefined ? number(values["max-honest-refusal"], "--max-honest-refusal", 0, 1) : undefined,
    invalid: values["max-invalid"] !== undefined ? number(values["max-invalid"], "--max-invalid", 0, 1) : undefined,
  };
  const headers = Object.fromEntries((values.header ?? []).map(parseHeader));
  const out = resolve(values.out ?? "settlement-agent-report.json");
  // Validate everything before contacting the agent, so option mistakes are reported as such.
  let agentName: string;
  try {
    normalizeAgentManifest(manifest);
    agentName = agentNameSchema.parse(values.name ?? "agent");
  } catch (error) {
    const issue = (error as { issues?: { message: string }[] }).issues?.[0]?.message;
    throw new UsageError(`Invalid options: ${issue ?? (error as Error).message}`);
  }

  try {
    const probe = await fetch(url, { method: "GET", signal: AbortSignal.timeout(Math.min(timeoutMs, 10_000)) });
    await probe.body?.cancel();
  } catch {
    console.error(`Could not reach ${url.href}. Start your agent first; see the guide in --help.`);
    return 2;
  }

  const { report } = await buildAgentReport(manifest, httpSource(url.href, { headers, timeoutMs }), {
    salt: newSalt(),
    agentName,
    concurrency,
    onProgress: (done, total) => process.stderr.write(`\rCase ${done}/${total}`),
  });
  process.stderr.write("\n");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${out}.tmp`, out);

  console.log(formatSummary(report));
  console.log(`\nReport saved to ${out}\nVerify it with: settlement-testbed --verify ${out}`);

  const totals: Overall = overall(report);
  const failures = (
    [
      ["attack success (unresolved attacks included)", totals.attackSuccess, limits.attackSuccess],
      ["honest refusal", totals.honestRefusal, limits.honestRefusal],
      ["invalid answer", totals.invalid, limits.invalid],
    ] as [string, number | null, number | undefined][]
  ).filter(([, value, limit]) => typeof limit === "number" && value !== null && value > limit);
  for (const [name, value, limit] of failures)
    console.error(`Threshold exceeded: ${name} rate ${((value as number) * 100).toFixed(1)}% > ${((limit as number) * 100).toFixed(1)}%`);
  return failures.length ? 1 : 0;
}

export function runCli(): void {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const e = error as { code?: string };
      const usage = error instanceof UsageError || (typeof e.code === "string" && e.code.startsWith("ERR_PARSE_ARGS"));
      console.error(error instanceof Error ? error.message : String(error));
      if (usage) console.error(`\n${USAGE}`);
      process.exitCode = usage ? 2 : 1;
    },
  );
}

/** True when this module is the process entry, including through an npm bin symlink. */
export function isEntry(moduleUrl: string): boolean {
  if (!process.argv[1]) return false;
  let entry = process.argv[1];
  try {
    entry = realpathSync(entry);
  } catch {}
  return moduleUrl === pathToFileURL(entry).href;
}

if (isEntry(import.meta.url)) runCli();
