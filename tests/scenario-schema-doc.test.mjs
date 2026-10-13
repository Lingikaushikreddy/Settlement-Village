import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { scenarioDefinitionSchema } from "../lib/sim/scenario-schema.ts";

test("the authoring doc's schema table is current and names every top-level field", () => {
  const check = spawnSync(process.execPath, ["scripts/build-scenario-schema-doc.mjs", "--check"], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const doc = readFileSync("docs/scenario-authoring.md", "utf8");
  const shape = scenarioDefinitionSchema.innerType().shape;
  for (const field of Object.keys(shape)) assert.match(doc, new RegExp(`\\| \`${field}\``), `doc lacks ${field}`);
});

test("the schema block holds exactly one table and nothing else", () => {
  const doc = readFileSync("docs/scenario-authoring.md", "utf8");
  assert.equal(doc.split("<!-- schema:start -->").length, 2, "exactly one start marker");
  const block = doc.match(/<!-- schema:start -->\n([\s\S]*?)\n<!-- schema:end -->/)[1];
  const lines = block.split("\n");
  assert.equal(lines[0], "| Field | Type | Required | Meaning |");
  assert.equal(lines[1], "| --- | --- | --- | --- |");
  for (const line of lines) assert.match(line, /^\| .* \|$/, `non-table line in schema block: ${line.slice(0, 60)}`);
  assert.ok(lines.some((l) => l.includes("`^[a-z][a-z0-9-]{1,39}$`")), "the id pattern survives with its dollar sign");
});
