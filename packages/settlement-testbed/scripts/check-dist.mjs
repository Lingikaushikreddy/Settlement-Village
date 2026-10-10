// Fails the build when dist/ contains anything the package must not ship.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const problems = [];
function walk(dir, rel = "") {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const key = rel ? `${rel}/${name}` : name;
    if (statSync(path).isDirectory()) walk(path, key);
    else {
      const allowed = key.startsWith("sim/") || key.startsWith("testbed/") || /^agent\/social\.(js|d\.ts)$/.test(key);
      if (key.startsWith("sim/scenarios/") && key.endsWith(".json") && !/^sim\/scenarios\/(scarcity|reputation|injection|benign)\.json$/.test(key))
        problems.push(`unexpected scenario file ${key}`);
      if (!allowed) problems.push(`unexpected file ${key}`);
      if (/\.(js|d\.ts)$/.test(key) && /from\s+"[^"]+\.ts"/.test(readFileSync(path, "utf8")))
        problems.push(`${key} imports a .ts path`);
    }
  }
}
walk(dist);
const cli = readFileSync(join(dist, "testbed/cli.js"), "utf8");
if (!cli.startsWith("#!/usr/bin/env node\n")) problems.push("testbed/cli.js has no shebang");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("dist/ is clean");
