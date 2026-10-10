import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("the package README is generated from the testbed guide and is up to date", () => {
  const check = spawnSync(process.execPath, ["scripts/build-package-readme.mjs", "--check"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const readme = readFileSync("packages/settlement-testbed/README.md", "utf8");
  assert.match(readme, /^# settlement-testbed/m);
  assert.match(readme, /npx settlement-testbed --agent/);
  assert.match(readme, /Settlement-Protocol: 1/);
  assert.match(readme, /What a score does not mean/);
  assert.ok(!/<!-- package-readme/.test(readme), "marker comments are stripped");
});
