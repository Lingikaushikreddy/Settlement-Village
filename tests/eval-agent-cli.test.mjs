import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { overall, parseHeader, parseSeeds } from "../scripts/eval-agent.mjs";

const cli = (args) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "scripts/eval-agent.mjs", ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
// Async variant for tests whose fake agent runs in this process: spawnSync would block its event loop.
const cliAsync = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/eval-agent.mjs", ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
async function startAgent(command, args) {
  const child = spawn(command, args, { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "inherit"] });
  const url = await new Promise((resolve, reject) => {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (text) => {
      const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/decide/);
      if (match) resolve(match[0]);
    });
    child.on("exit", (code) => reject(new Error(`agent exited with ${code}`)));
  });
  return { child, url };
}
const tiny = ["--scenarios", "injection,benign", "--seeds", "1-2", "--ticks", "60"];

test("seed, header and threshold helpers", () => {
  assert.deepEqual(parseSeeds("1-3"), [1, 2, 3]);
  assert.deepEqual(parseSeeds("5,2,9"), [5, 2, 9]);
  assert.throws(() => parseSeeds("3-1"), /upward/);
  assert.throws(() => parseSeeds("a"));
  assert.deepEqual(parseHeader("Authorization: Bearer x:y"), ["Authorization", "Bearer x:y"]);
  assert.throws(() => parseHeader("no-colon"));
  assert.deepEqual(
    overall({ rows: [
      { evaluable: 10, successes: 1, benignOffers: 0, benignRefused: 0, honestUnanswered: 0, decisions: 20, invalidDecisions: 2 },
      { evaluable: 0, successes: 0, benignOffers: 10, benignRefused: 1, honestUnanswered: 1, decisions: 10, invalidDecisions: 1 },
    ] }),
    { attackSuccess: 0.1, honestRefusal: 0.2, invalid: 0.1 },
  );
});

test("runs the Node example agent end to end and verifies the report", async () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-cli-"));
  const out = join(dir, "nested", "folder", "report.json");
  const { child, url } = await startAgent(process.execPath, ["examples/agents/node/agent.mjs"]);
  try {
    const run = cli(["--agent", url, "--name", "node-example", "--out", out, ...tiny, "--max-attack-success", "0"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /node-example/);
    assert.match(run.stdout, /Check evidence/);
    assert.ok(existsSync(out));
    const verify = cli(["--verify", out]);
    assert.equal(verify.status, 0, verify.stderr);
    assert.match(verify.stdout, /Verified/);
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Python example agent speaks the same protocol", { skip: spawnSync("python3", ["--version"]).status !== 0 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-cli-"));
  const { child, url } = await startAgent("python3", ["examples/agents/python/agent.py"]);
  try {
    const run = cli(["--agent", url, "--out", join(dir, "r.json"), "--scenarios", "injection", "--seeds", "1", "--ticks", "40"]);
    assert.equal(run.status, 0, run.stderr);
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("thresholds fail the command but still write the report", async () => {
  const server = createServer((req, res) => { req.resume(); res.writeHead(500).end(); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const dir = mkdtempSync(join(tmpdir(), "settlement-cli-"));
  const out = join(dir, "report.json");
  try {
    const run = await cliAsync(["--agent", `http://127.0.0.1:${server.address().port}/`, "--out", out, ...tiny, "--max-invalid", "0.05"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /invalid/i);
    assert.ok(existsSync(out));
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unreachable agent exits 2 without writing a report", () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-cli-"));
  const out = join(dir, "report.json");
  try {
    const run = cli(["--agent", "http://127.0.0.1:9/decide", "--out", out]);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /Could not reach/);
    assert.ok(!existsSync(out));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("bad usage exits 2 with help", () => {
  const run = cli(["--seeds", "1-3"]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Usage/);
  assert.equal(cli(["--agent", "http://127.0.0.1:9", "--bogus"]).status, 2);
  const tooMany = cli(["--agent", "http://127.0.0.1:9/decide", "--seeds", "1-11"]);
  assert.equal(tooMany.status, 2);
  assert.match(tooMany.stderr, /Invalid options/);
});
