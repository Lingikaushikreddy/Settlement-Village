// The package, the action's default package-version and the repository must agree.
import { readFileSync } from "node:fs";

const root = JSON.parse(readFileSync("package.json", "utf8")).version;
const pkg = JSON.parse(readFileSync("packages/settlement-testbed/package.json", "utf8")).version;
const action = readFileSync("action.yml", "utf8");
const m = action.match(/package-version:\s*\n(?:\s+description:[^\n]*\n)?\s+default:\s*"([^"]+)"/);
const actionVersion = m?.[1];
const problems = [];
if (pkg !== root) problems.push(`packages/settlement-testbed/package.json is ${pkg}, root is ${root}`);
if (actionVersion !== root) problems.push(`action.yml package-version default is ${actionVersion}, root is ${root}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`versions agree: ${root}`);
