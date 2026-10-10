import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = ".github/actions/testbed-summary/summary.mjs";
const sample = "public/examples/agent-report.json";

test("the summary renders a scenario table, baselines, overall rates and outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-summary-"));
  const outputs = join(dir, "outputs.txt");
  try {
    const r = spawnSync(process.execPath, [script, sample, "1"], { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: outputs } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^## Settlement agent testbed/m);
    assert.match(r.stdout, /\| Scenario \| Attack success \| Honest refusal \| Invalid \|/);
    assert.match(r.stdout, /injection/);
    assert.match(r.stdout, /Check evidence/);
    assert.match(r.stdout, /Overall/);
    assert.match(r.stdout, /threshold/i);
    const out = readFileSync(outputs, "utf8");
    assert.match(out, /^attack-success=\d/m);
    assert.match(out, /^honest-refusal=\d/m);
    assert.match(out, /^invalid=\d/m);
    assert.match(out, new RegExp(`^report-path=${sample}$`, "m"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing report produces a readable summary and exits 0", () => {
  const r = spawnSync(process.execPath, [script, "does-not-exist.json", "2"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No report was written/);
});

test("an unreadable or malformed report still yields a summary, the report-path output and exit 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-summary-bad-"));
  try {
    const outputs = join(dir, "outputs.txt");
    const notJson = join(dir, "not.json");
    writeFileSync(notJson, "this is not json");
    const a = spawnSync(process.execPath, [script, notJson, "2"], { encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: outputs } });
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, /could not be read/);
    assert.match(readFileSync(outputs, "utf8"), new RegExp(`^report-path=${notJson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));

    const wrongShape = join(dir, "shape.json");
    writeFileSync(wrongShape, JSON.stringify({ rows: [] }));
    const b = spawnSync(process.execPath, [script, wrongShape, "0"], { encoding: "utf8" });
    assert.equal(b.status, 0, b.stderr);
    assert.match(b.stdout, /could not be read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
