// Thin wrapper so `npm run eval:agent` keeps working from the repository.
// The CLI lives in lib/testbed/cli.ts and ships as the settlement-testbed package.
export { main, overall, parseHeader, parseSeeds, formatSummary } from "../lib/testbed/cli.ts";
import { isEntry, runCli } from "../lib/testbed/cli.ts";

if (isEntry(import.meta.url)) runCli();
