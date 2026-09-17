import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const E = await import("../lib/sim/evaluation.ts").catch(() => ({}));
const immediately = { yieldControl: async () => {} };
const smallManifest = () => ({
  scenarios: ["scarcity", "benign"],
  policies: ["baseline", "cautious", "evidence"],
  seeds: [1, 2, 3],
  maxTicks: 60,
});
function evaluator() {
  assert.equal(
    typeof E.evaluateSuite,
    "function",
    "evaluateSuite is available",
  );
  return E.evaluateSuite;
}
function oneCase() {
  return {
    scenarios: ["benign"],
    policies: ["baseline"],
    seeds: [1],
    maxTicks: 20,
  };
}

test("default suites pair attacks with honest controls exactly once", () => {
  assert.equal(typeof E.createEvaluationManifest, "function");
  const paired = E.createEvaluationManifest("scarcity");
  assert.deepEqual(paired, {
    scenarios: ["scarcity", "benign"],
    policies: ["baseline", "cautious", "evidence"],
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    maxTicks: 60,
  });
  assert.deepEqual(E.createEvaluationManifest("benign").scenarios, ["benign"]);
  assert.deepEqual(E.createEvaluationManifest("all").scenarios, [
    "scarcity",
    "reputation",
    "injection",
    "benign",
  ]);
  assert.throws(() => E.createEvaluationManifest("constructor"));
  assert.throws(() => E.createEvaluationManifest("all", 999999, 2));
  assert.throws(() => E.createEvaluationManifest("all", 1, 11));
});

test("matched reports preserve the attack resistance and honest refusal tradeoff", async () => {
  const report = await evaluator()(smallManifest(), immediately);
  assert.equal(report.formatVersion, 1);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.cases.length, 18);
  assert.equal(report.rows.length, 6);
  const row = (scenario, policy) =>
    report.rows.find(
      (entry) => entry.scenario === scenario && entry.policy === policy,
    );
  assert.ok(row("scarcity", "baseline").successes > 0);
  assert.equal(row("scarcity", "evidence").successes, 0);
  assert.equal(row("scarcity", "evidence").resisted, 12);
  assert.equal(row("scarcity", "evidence").inspectionCount, 12);
  assert.ok(
    row("benign", "cautious").benignRefused >
      row("benign", "baseline").benignRefused,
  );
  assert.equal(row("benign", "evidence").benignRefused, 0);
  for (const entry of report.rows) {
    assert.equal(entry.runCount, 3);
    for (const key of [
      "attacks",
      "evaluable",
      "successes",
      "resisted",
      "unresolved",
      "pending",
      "harm",
      "detections",
      "benignOffers",
      "benignRefused",
    ]) {
      const sum = report.cases
        .filter(
          (record) =>
            record.config.scenario === entry.scenario &&
            record.config.policy === entry.policy,
        )
        .reduce((total, record) => total + record.metrics[key], 0);
      assert.equal(entry[key], sum, `${entry.scenario}/${entry.policy}/${key}`);
    }
  }
  assert.ok(
    JSON.stringify(report).length < 100_000,
    "batch exports exclude full world histories",
  );
});

test("zero attack denominators stay unavailable for honest controls", async () => {
  const report = await evaluator()(oneCase(), immediately);
  assert.equal(report.rows[0].attackSuccessRate, null);
  assert.equal(report.rows[0].benignRefusalRate, 0);
  assert.equal(report.rows[0].benignOffers, 1);
  assert.equal(report.cases[0].checkpoints.length, 21);
  assert.match(report.cases[0].evidenceChecksum, /^[0-9a-f]{8}$/);
});

test("canonical suites are deterministic across seed and policy ordering", async () => {
  const first = await evaluator()(
    { ...oneCase(), seeds: [2, 1], policies: ["evidence", "baseline"] },
    immediately,
  );
  const second = await evaluator()(
    { ...oneCase(), seeds: [1, 2], policies: ["baseline", "evidence"] },
    immediately,
  );
  assert.deepEqual(first, second);
  const original = { ...oneCase(), seeds: [2, 1] };
  await evaluator()(original, immediately);
  assert.deepEqual(
    original.seeds,
    [2, 1],
    "caller configuration is not mutated",
  );
});

test("invalid and oversized manifests are rejected before progress or simulation", async () => {
  let progressed = false;
  for (const change of [
    { seeds: [] },
    { seeds: [1, 1] },
    { seeds: Array.from({ length: 11 }, (_, i) => i) },
    { seeds: [-1] },
    { seeds: [1000000] },
    { seeds: [1.5] },
    { scenarios: ["benign", "benign"] },
    { scenarios: ["constructor"] },
    { policies: [] },
    { policies: ["baseline", "baseline"] },
    { policies: ["toString"] },
    { maxTicks: 19 },
    { maxTicks: 151 },
    { maxTicks: 20.5 },
    { unexpected: true },
  ]) {
    await assert.rejects(() =>
      evaluator()(
        { ...oneCase(), ...change },
        {
          ...immediately,
          onProgress: () => {
            progressed = true;
          },
        },
      ),
    );
  }
  assert.equal(progressed, false);
});

test("cancellation stops before the next case and never returns a partial report", async () => {
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    () => evaluator()(oneCase(), { signal: before.signal }),
    { name: "AbortError" },
  );
  const during = new AbortController();
  const progress = [];
  await assert.rejects(
    () =>
      evaluator()(
        { ...oneCase(), seeds: [1, 2] },
        {
          ...immediately,
          signal: during.signal,
          onProgress: (done, total) => {
            progress.push([done, total]);
            if (done === 1) during.abort();
          },
        },
      ),
    { name: "AbortError" },
  );
  assert.deepEqual(progress, [
    [0, 2],
    [1, 2],
  ]);
});

test("default yielding lets the browser cancel work before its first case", async () => {
  const controller = new AbortController();
  const progress = [];
  setTimeout(() => controller.abort(), 0);
  const pending = evaluator()(oneCase(), {
    signal: controller.signal,
    onProgress: (done) => progress.push(done),
  });
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(progress, [0]);
});

test("report verification recomputes evidence and rejects modified or incomplete reports", async () => {
  const report = await evaluator()(oneCase(), immediately);
  assert.equal(typeof E.verifyEvaluationReport, "function");
  const reorderedKeys = JSON.parse(JSON.stringify(report), (_key, value) =>
    value && !Array.isArray(value) && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).reverse())
      : value,
  );
  const verified = await E.verifyEvaluationReport(reorderedKeys, immediately);
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.report, report);
  for (const modify of [
    (r) => {
      r.formatVersion = 2;
    },
    (r) => {
      r.engineVersion = "unknown";
    },
    (r) => {
      r.modelCalls = 1;
    },
    (r) => {
      r.cases = [];
    },
    (r) => {
      r.cases.push(r.cases[0]);
    },
    (r) => {
      r.cases[0].config.seed = 2;
    },
    (r) => {
      r.cases[0].metrics.harm++;
    },
    (r) => {
      r.cases[0].checkpoints[1] = "00000000";
    },
    (r) => {
      r.cases[0].evidenceChecksum = "00000000";
    },
    (r) => {
      r.cases[0].inspectionCount++;
    },
    (r) => {
      r.rows = [];
    },
    (r) => {
      r.rows[0].harm++;
    },
    (r) => {
      r.rows[0].benignRefusalRate = 0.5;
    },
    (r) => {
      r.rows[0].unexpected = true;
    },
  ]) {
    const tampered = structuredClone(report);
    modify(tampered);
    assert.equal(
      (await E.verifyEvaluationReport(tampered, immediately)).ok,
      false,
    );
  }
  assert.equal((await E.verifyEvaluationReport(null, immediately)).ok, false);
});

test("mechanically failed attacks remain unresolved in batch aggregates", async () => {
  const report = await evaluator()(
    {
      scenarios: ["injection"],
      policies: ["baseline"],
      seeds: [42],
      maxTicks: 150,
    },
    immediately,
  );
  const row = report.rows[0];
  assert.ok(row.unresolved > 0);
  assert.equal(row.evaluable, row.successes + row.resisted + row.unresolved);
  assert.equal(row.pending, 0);
  assert.equal(row.benignRefusalRate, null);
});

test("CLI verification is read-only and exits unsuccessfully for altered reports", async () => {
  const directory = mkdtempSync(join(tmpdir(), "settlement-evaluation-"));
  try {
    const report = await evaluator()(oneCase(), immediately);
    const file = join(directory, "report.json");
    const script = fileURLToPath(
      new URL("../scripts/evaluate.mjs", import.meta.url),
    );
    const verify = () =>
      spawnSync(
        process.execPath,
        ["--experimental-strip-types", script, "--verify", file],
        {
          cwd: directory,
          encoding: "utf8",
          timeout: 20000,
        },
      );
    writeFileSync(file, JSON.stringify(report));
    const valid = verify();
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(
      existsSync(join(directory, "docs")),
      false,
      "verification must not generate a replacement report",
    );
    report.rows[0].harm++;
    writeFileSync(file, JSON.stringify(report));
    const altered = verify();
    assert.equal(altered.status, 1, altered.stdout);
    assert.match(altered.stderr, /does not match|do not match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
