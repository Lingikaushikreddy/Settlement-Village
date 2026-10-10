// One-shot: create or update the repository labels from .github/labels.yml.
// Usage: node scripts/sync-labels.mjs   (needs `gh auth status` to succeed)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = readFileSync(".github/labels.yml", "utf8");
const labels = [...source.matchAll(/name: "([^"]+)", color: "([0-9a-f]{6})", description: "([^"]*)"/g)];
if (!labels.length) throw new Error("No labels parsed from .github/labels.yml");
for (const [, name, color, description] of labels) {
  const result = spawnSync(
    "gh",
    ["label", "create", name, "--color", color, "--description", description, "--force"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exitCode = 1;
}
