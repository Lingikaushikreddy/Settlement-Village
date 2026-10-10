import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pkg = "packages/settlement-testbed";
const dist = join(pkg, "dist");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test("the package builds and its output is only the engine, social adapter and testbed", () => {
  const build = spawnSync("npm", ["run", "build:package"], { encoding: "utf8" });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const files = walk(dist).map((p) => p.slice(dist.length + 1));
  assert.ok(files.includes("testbed/cli.js"), "cli.js is emitted");
  assert.ok(files.includes("testbed/index.js") && files.includes("testbed/index.d.ts"), "index is emitted");
  const stray = files.filter((f) => !(f.startsWith("sim/") || f.startsWith("testbed/") || /^agent\/social\.(js|d\.ts)$/.test(f)));
  assert.deepEqual(stray, [], "no game, worker or Claude adapter code in the package");
  for (const f of files.filter((f) => /\.(js|d\.ts)$/.test(f))) {
    const text = readFileSync(join(dist, f), "utf8");
    assert.ok(!/from\s+"[^"]+\.ts"/.test(text), `${f} still imports a .ts path`);
  }
  assert.ok(readFileSync(join(dist, "testbed/cli.js"), "utf8").startsWith("#!/usr/bin/env node\n"), "cli.js keeps its shebang");
  const check = spawnSync("npm", ["run", "check:package"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test("npm pack publishes exactly dist, README and package.json", () => {
  assert.ok(existsSync(join(pkg, "README.md")), "README exists (generated in Task 6; a placeholder is fine here)");
  const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: pkg, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stderr);
  const paths = JSON.parse(pack.stdout)[0].files.map((f) => f.path).sort();
  assert.ok(paths.every((p) => p === "package.json" || p === "README.md" || p.startsWith("dist/")), paths.join("\n"));
  assert.ok(paths.includes("dist/testbed/cli.js"));
});
