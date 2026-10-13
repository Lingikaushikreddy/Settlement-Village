// Writes the field table between <!-- schema:start --> and <!-- schema:end --> in docs/scenario-authoring.md.
// The table lives here so the doc and lib/sim/scenario-schema.ts change together in review.
import { readFileSync, writeFileSync } from "node:fs";
const rows = [
  ["id", "slug `^[a-z][a-z0-9-]{1,39}$`", "yes", "Unique id; must not equal a built-in (scarcity, reputation, injection, benign)."],
  ["name", "string ≤ 80", "yes", "Shown in reports and the browser inspector."],
  ["description", "string ≤ 200", "yes", "One sentence for listings."],
  ["kind", "`attack` or `honest`", "yes", "Attacks count toward attack success; honest offers toward honest refusal."],
  ["claim", "string ≤ 400", "yes", "The exact text the target receives. This is the only scenario text an agent sees."],
  ["claimTitle", "string ≤ 80", "yes", "Event title in replays (built-ins use \"A claim begins to spread\" / \"An offer at the market\")."],
  ["goal", "string ≤ 80", "yes", "The resident's goal label while deciding."],
  ["proposer", "`rook` or `theo`", "yes", "Who posts the offer the claim refers to."],
  ["claimant", "agent id", "no", "Who voices the claim in the replay and the agent's `publicClaims`; defaults to `rook`. Use `theo` for an honest offer Theo makes himself."],
  ["excludeTargets", "agent ids", "no", "Residents never targeted. The proposer is always excluded automatically."],
  ["offer", "`{ give, receive }` inventories", "yes", "`receive.coins` is the price shown as `offerPrice`."],
  ["acceptMeans", "`trade_with_proposer` or `refuse_proposer`", "yes", "What `accept_claim` does: execute the offer, or act on an allegation and refuse the proposer's fair trade."],
  ["evidence", "`{ site, fact }`", "yes", "`site` is one of farm, granary, market, well, workshop: where `check_evidence` walks the resident. `fact` is what inspection reveals; it may embed `{{stock:<location>:<resource>}}`."],
  ["contradiction", "`always` · `never` · `stock_above {location, resource, threshold, honorsPublishedStock}`", "yes", "When verified evidence makes a built-in policy refuse. `always` means the claim is false once checked."],
  ["harm", "`overpay {reference}` · `lost_trade {amount}` · `none`", "yes", "What a wrong decision costs: `overpay` requires `acceptMeans: trade_with_proposer`; `lost_trade` requires `acceptMeans: refuse_proposer`; `none` works with either."],
  ["summaries", "object", "yes", "`accepted`, `refusedByEvidence`, `refusedByTrust`; plus `actedOnAllegation` and `declinedAllegation` for `refuse_proposer`. `{{name}}` and `{{price}}` expand."],
  ["resolvesOnDecision", "boolean", "no", "`true` for honest offers: the incident resolves when the resident decides."],
];
const table = ["| Field | Type | Required | Meaning |", "| --- | --- | --- | --- |", ...rows.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} | ${r[3]} |`)].join("\n");
const path = "docs/scenario-authoring.md";
const doc = readFileSync(path, "utf8");
// Use a callback so the dollar-backtick sequence in the id pattern stays literal.
const next = doc.replace(/<!-- schema:start -->[\s\S]*?<!-- schema:end -->/, () => `<!-- schema:start -->\n${table}\n<!-- schema:end -->`);
if (process.argv.includes("--check")) {
  if (next !== doc) {
    console.error(`${path} schema table is out of date. Run: node scripts/build-scenario-schema-doc.mjs`);
    process.exit(1);
  }
  console.log(`${path} schema table is up to date`);
} else {
  writeFileSync(path, next);
  console.log(`wrote ${path}`);
}
