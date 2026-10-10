import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGalleryIndex } from "../lib/gallery/index-schema.ts";
import { summarizeGalleryEntry } from "../lib/gallery/summary.ts";

const index = () => JSON.parse(readFileSync("gallery/index.json", "utf8"));
const verify = (args = []) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "scripts/verify-gallery.mjs", ...args], { encoding: "utf8", timeout: 300_000 });

test("the committed gallery verifies and the summary carries baselines", () => {
  const run = verify();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /node-example-rules/);
  const entries = parseGalleryIndex(index());
  assert.ok(entries.length >= 1);
  const report = JSON.parse(readFileSync(entries[0].report, "utf8"));
  const summary = summarizeGalleryEntry(entries[0], report);
  assert.equal(summary.cases, report.cases.length);
  assert.ok(summary.scenarios.length >= 4);
  const injection = summary.scenarios.find((s) => s.id === "injection");
  assert.equal(injection.baselineAttackSuccess, 0);
  const reciprocity = summary.scenarios.find((s) => s.id === "reciprocity");
  assert.equal(reciprocity.name, "The Invented Debt");
  assert.equal(reciprocity.attackSuccess, 1);
});

test("the verifier rejects a name mismatch, a missing report, an unlisted report and an edited report", () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-gallery-"));
  cpSync("gallery", join(dir, "gallery"), { recursive: true });
  const verifyIn = () => verify(["--root", dir]);
  try {
    const original = JSON.parse(readFileSync(join(dir, "gallery/index.json"), "utf8"));
    let idx = structuredClone(original);
    idx[0].agent.name = "someone-else";
    writeFileSync(join(dir, "gallery/index.json"), JSON.stringify(idx));
    let r = verifyIn();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /agent\.name/);

    idx = structuredClone(original);
    idx.push({ ...original[0], id: "ghost", report: "gallery/ghost.json" });
    writeFileSync(join(dir, "gallery/index.json"), JSON.stringify(idx));
    r = verifyIn();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ghost\.json/);

    writeFileSync(join(dir, "gallery/index.json"), JSON.stringify(original));
    writeFileSync(join(dir, "gallery/stray.json"), "{}");
    r = verifyIn();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /stray\.json/);
    rmSync(join(dir, "gallery/stray.json"));

    const report = JSON.parse(readFileSync(join(dir, original[0].report), "utf8"));
    report.rows[0].successes += 1;
    writeFileSync(join(dir, original[0].report), JSON.stringify(report));
    r = verifyIn();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not match|verification failed/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
