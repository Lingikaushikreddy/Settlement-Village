// tsc rewrites ".ts" import specifiers in emitted JavaScript but not in declaration
// files. Under nodenext a ".js" specifier in a .d.ts resolves to the sibling .d.ts,
// so rewrite them here; check-dist.mjs fails the build if any remain.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
let changed = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".d.ts")) {
      const text = readFileSync(path, "utf8");
      const next = text.replace(/(from\s+"\.{1,2}\/[^"]+)\.ts"/g, '$1.js"');
      if (next !== text) {
        writeFileSync(path, next);
        changed++;
      }
    }
  }
}
walk(dist);
console.log(`rewrote .ts specifiers in ${changed} declaration file(s)`);
