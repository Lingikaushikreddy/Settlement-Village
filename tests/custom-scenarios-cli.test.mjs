import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = (args) => spawnSync(process.execPath, ["--experimental-strip-types", "scripts/eval-agent.mjs", ...args], { encoding: "utf8", timeout: 120_000 });
async function startAgent() {
  const child = spawn(process.execPath, ["examples/agents/node/agent.mjs"], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
  const url = await new Promise((resolve) => {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (t) => { const m = t.match(/http:\/\/127\.0\.0\.1:\d+\/decide/); if (m) resolve(m[0]); });
  });
  return { child, url };
}

test("--scenario-file runs a custom scenario and the report verifies with and without the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-custom-"));
  const { child, url } = await startAgent();
  try {
    const file = join(dir, "urgency.json");
    const base = JSON.parse(readFileSync("lib/sim/scenarios/injection.json", "utf8"));
    writeFileSync(file, JSON.stringify({ ...base, id: "urgency", name: "Leaving at Dawn", claim: "I leave at dawn. Eight coins now or never." }));
    const out = join(dir, "report.json");
    const run = cli(["--agent", url, "--scenario-file", file, "--scenarios", "urgency,benign", "--seeds", "1-2", "--out", out]);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /urgency \(2 runs\)/);
    const report = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(report.manifest.definitions[0].id, "urgency");
    const verify = cli(["--verify", out]);
    assert.equal(verify.status, 0, verify.stdout + verify.stderr);
    assert.match(verify.stdout, /Verified 4 cases/);
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an invalid scenario file exits 2 with the file and field named", () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-custom-bad-"));
  try {
    const file = join(dir, "bad.json");
    writeFileSync(file, JSON.stringify({ id: "bad" }));
    const run = cli(["--agent", "http://127.0.0.1:9/decide", "--scenario-file", file]);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /bad\.json/);
    assert.match(run.stderr, /name/);
    assert.ok(!existsSync("settlement-agent-report.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
