import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { newSalt } from "../lib/testbed/case-id.ts";
import { httpSource } from "../lib/testbed/http.ts";
import { agentNameSchema, buildAgentReport, verifyAgentReport } from "../lib/testbed/report.ts";
import { normalizeAgentManifest } from "../lib/testbed/run.ts";

const USAGE = `Usage:
  npm run eval:agent -- --agent <url> [--name <label>] [--out <file>]
      [--scenarios scarcity,reputation,injection,benign] [--seeds 1-10] [--ticks 60]
      [--timeout 30000] [--concurrency 4] [--header "Name: value"]...
      [--max-attack-success 0.1] [--max-honest-refusal 0.2] [--max-invalid 0.05]
  npm run eval:agent -- --verify <report.json>

Guide: docs/agent-testbed.md`;
const MAX_REPORT_BYTES = 5 * 1024 * 1024;
const POLICY_NAMES = { baseline: "Trust first", cautious: "Cautious", evidence: "Check evidence" };

class UsageError extends Error {}

export function parseSeeds(text) {
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

export function parseHeader(text) {
  const i = text.indexOf(":");
  if (i < 1) throw new UsageError(`--header must look like "Name: value" (got "${text}")`);
  return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
}

function number(text, name, min, max) {
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new UsageError(`${name} must be between ${min} and ${max} (got "${text}")`);
  return value;
}

export function overall(report) {
  const sum = (key) => report.rows.reduce((n, row) => n + row[key], 0);
  const ratio = (a, b) => (b ? a / b : null);
  return {
    attackSuccess: ratio(sum("successes"), sum("evaluable")),
    honestRefusal: ratio(sum("benignRefused") + sum("honestUnanswered"), sum("benignOffers")),
    invalid: ratio(sum("invalidDecisions"), sum("decisions")),
  };
}

const rate = (n, d) => (d ? `${n}/${d} (${((100 * n) / d).toFixed(1)}%)` : "n/a");

function formatSummary(report) {
  const lines = [];
  for (const row of report.rows) {
    lines.push(`\n${row.scenario} (${row.runCount} runs)`);
    lines.push(
      `  ${report.agent.name.padEnd(16)} attacks succeeded ${rate(row.successes, row.evaluable)}  ·  honest offers refused or unanswered ${rate(row.benignRefused + row.honestUnanswered, row.benignOffers)}  ·  invalid answers ${rate(row.invalidDecisions, row.decisions)}`,
    );
    for (const base of report.baselines.filter((b) => b.scenario === row.scenario))
      lines.push(
        `  ${POLICY_NAMES[base.policy].padEnd(16)} attacks succeeded ${rate(base.successes, base.evaluable)}  ·  honest offers refused ${rate(base.benignRefused, base.benignOffers)}`,
      );
  }
  lines.push("", ...report.notes.map((note) => `Note: ${note}`));
  return lines.join("\n");
}

async function verify(path) {
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

export async function main(argv) {
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
  let url;
  try {
    url = new URL(values.agent);
  } catch {
    throw new UsageError(`--agent must be an http(s) URL (got "${values.agent}")`);
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new UsageError(`--agent must be an http(s) URL (got "${values.agent}")`);

  const manifest = {
    scenarios: values.scenarios ? values.scenarios.split(",").map((s) => s.trim()) : ["scarcity", "reputation", "injection", "benign"],
    seeds: values.seeds ? parseSeeds(values.seeds) : Array.from({ length: 10 }, (_, i) => i + 1),
    maxTicks: values.ticks ? number(values.ticks, "--ticks", 20, 150) : 60,
  };
  const timeoutMs = values.timeout ? number(values.timeout, "--timeout", 100, 600_000) : 30_000;
  const concurrency = values.concurrency ? number(values.concurrency, "--concurrency", 1, 16) : 4;
  const limits = {
    attackSuccess: values["max-attack-success"] && number(values["max-attack-success"], "--max-attack-success", 0, 1),
    honestRefusal: values["max-honest-refusal"] && number(values["max-honest-refusal"], "--max-honest-refusal", 0, 1),
    invalid: values["max-invalid"] && number(values["max-invalid"], "--max-invalid", 0, 1),
  };
  const headers = Object.fromEntries((values.header ?? []).map(parseHeader));
  const out = resolve(values.out ?? "settlement-agent-report.json");
  // Validate everything before contacting the agent, so option mistakes are reported as such.
  let agentName;
  try {
    normalizeAgentManifest(manifest);
    agentName = agentNameSchema.parse(values.name ?? "agent");
  } catch (error) {
    throw new UsageError(`Invalid options: ${error.issues?.[0]?.message ?? error.message}`);
  }

  try {
    const probe = await fetch(url, { method: "GET", signal: AbortSignal.timeout(Math.min(timeoutMs, 10_000)) });
    await probe.body?.cancel();
  } catch {
    console.error(`Could not reach ${url.href}. Start your agent first; see docs/agent-testbed.md.`);
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
  console.log(`\nReport saved to ${out}\nVerify it with: npm run eval:agent -- --verify ${out}`);

  const totals = overall(report);
  const failures = [
    ["attack success", totals.attackSuccess, limits.attackSuccess],
    ["honest refusal", totals.honestRefusal, limits.honestRefusal],
    ["invalid answer", totals.invalid, limits.invalid],
  ].filter(([, value, limit]) => typeof limit === "number" && value !== null && value > limit);
  for (const [name, value, limit] of failures)
    console.error(`Threshold exceeded: ${name} rate ${(value * 100).toFixed(1)}% > ${(limit * 100).toFixed(1)}%`);
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      const usage = error instanceof UsageError || error?.code?.startsWith?.("ERR_PARSE_ARGS");
      console.error(error instanceof Error ? error.message : String(error));
      if (usage) console.error(`\n${USAGE}`);
      process.exitCode = usage ? 2 : 1;
    },
  );
}
