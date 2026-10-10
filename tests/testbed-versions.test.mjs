import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("check-versions passes on the repository and fails when one copy drifts", () => {
  const ok = spawnSync(process.execPath, ["scripts/check-versions.mjs"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const dir = mkdtempSync(join(tmpdir(), "settlement-versions-"));
  try {
    for (const f of ["package.json", "packages/settlement-testbed/package.json", "action.yml", "scripts/check-versions.mjs"])
      cpSync(f, join(dir, f), { recursive: true });
    const action = readFileSync(join(dir, "action.yml"), "utf8").replace(/default: "\d+\.\d+\.\d+"/, 'default: "9.9.9"');
    writeFileSync(join(dir, "action.yml"), action);
    const bad = spawnSync(process.execPath, ["scripts/check-versions.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /action\.yml.*9\.9\.9/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
