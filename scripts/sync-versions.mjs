// Run by `npm version` after the root package.json is bumped: copy the version to the package and the action.
import { readFileSync, writeFileSync } from "node:fs";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const pkgPath = "packages/settlement-testbed/package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
const actionPath = "action.yml";
writeFileSync(actionPath, readFileSync(actionPath, "utf8").replace(/(package-version:\s*\n(?:\s+description:[^\n]*\n)?\s+default:\s*")[^"]+(")/, `$1${version}$2`));
console.log(`synced ${version}`);
