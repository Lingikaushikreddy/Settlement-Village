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
