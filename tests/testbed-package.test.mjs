import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(".");
const pkgDir = join(repo, "packages/settlement-testbed");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 180_000, ...opts });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

async function startAgent() {
  const child = spawn(process.execPath, [join(repo, "examples/agents/node/agent.mjs")], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const url = await new Promise((resolve, reject) => {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (t) => {
      const m = t.match(/http:\/\/127\.0\.0\.1:\d+\/decide/);
      if (m) resolve(m[0]);
    });
    child.on("exit", (c) => reject(new Error(`agent exited ${c}`)));
  });
  return { child, url };
}

test("the packed package installs in a fresh project and its reports cross-verify with the repo", async () => {
  const work = mkdtempSync(join(tmpdir(), "settlement-pkg-"));
  const { child, url } = await startAgent();
  try {
    const build = run("npm", ["run", "build:package"], { cwd: repo });
    assert.equal(build.status, 0, build.out);
    const check = run("npm", ["run", "check:package"], { cwd: repo });
    assert.equal(check.status, 0, check.out);
    // --ignore-scripts keeps prepack's build output out of the JSON; the build and check ran above.
    const pack = spawnSync("npm", ["pack", "--pack-destination", work, "--json", "--ignore-scripts"], { cwd: pkgDir, encoding: "utf8", timeout: 180_000 });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = join(work, JSON.parse(pack.stdout)[0].filename);
    const project = join(work, "consumer");
    mkdirSync(project);
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
    const install = run("npm", ["install", "--no-audit", "--no-fund", tarball], { cwd: project });
    assert.equal(install.status, 0, install.out);
    const bin = join(project, "node_modules/.bin/settlement-testbed");
    assert.ok(existsSync(bin), "bin link created");

    const report = join(project, "report.json");
    const evalRun = run(bin, ["--agent", url, "--name", "packaged-example", "--out", report, "--scenarios", "injection,benign", "--seeds", "1-2"], { cwd: project });
    assert.equal(evalRun.status, 0, evalRun.out);
    assert.ok(existsSync(report));
    assert.equal(JSON.parse(readFileSync(report, "utf8")).agent.name, "packaged-example");

    const verifyPkg = run(bin, ["--verify", report], { cwd: project });
    assert.equal(verifyPkg.status, 0, verifyPkg.out);
    assert.match(verifyPkg.out, /Verified 4 cases/);

    const verifyRepo = run("npm", ["run", "eval:agent", "--", "--verify", report], { cwd: repo });
    assert.equal(verifyRepo.status, 0, verifyRepo.out);
    assert.match(verifyRepo.out, /Verified 4 cases/);

    const unreachable = run(bin, ["--agent", "http://127.0.0.1:9/decide", "--out", join(project, "none.json")], { cwd: project });
    assert.equal(unreachable.status, 2);
    assert.match(unreachable.out, /Could not reach/);
    assert.ok(!existsSync(join(project, "none.json")));
  } finally {
    child.kill();
    rmSync(work, { recursive: true, force: true });
  }
});
