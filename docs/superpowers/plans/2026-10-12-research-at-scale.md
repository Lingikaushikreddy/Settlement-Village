# Research at Scale (0.12.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the whole research pack (4 built-ins + 12 research scenarios) in one verifiable report, make the Claude example agent survive a real paid run, publish the first real-model report in the gallery, and clear the known small bugs. Ship it as 0.12.0.

**Architecture:** No engine or protocol change. Raising the report limits only loosens zod caps in `lib/sim/evaluation.ts`, `lib/testbed/run.ts` and `lib/testbed/report.ts`, so every existing report still verifies byte-for-byte. The Claude agent gains retries for transient provider errors behind an injectable `fetch`. The live run is a human step (it needs his `ANTHROPIC_API_KEY`). Its report goes into `gallery/` like any other submission.

**Tech Stack:** Next.js 16.4 / React, TypeScript run through `node --experimental-strip-types`, zod, `node:test`, Playwright, GitHub Actions, npm (trusted publishing from `release.yml`).

**Spec:** This plan is its own spec. Its scope comes from the follow-ups recorded after 0.11.0: the README roadmap line "Larger research runs: more than four custom scenarios per report", `docs/research-grounding.md` (four batches), the live Claude path that has never been exercised, and the deferred minors from the 0.9.0–0.11.0 reviews.

## How to work in this repo (read first)

- Clone: `~/Desktop/Projects/Settlement-Village`, GitHub `Lingikaushikreddy/Settlement-Village`. With `gh`, always pass `-R Lingikaushikreddy/Settlement-Village`.
- **`main` is protected** (ruleset "main"): a PR is required, `verify (24)` must pass, history must be linear, and nothing bypasses this. Never push to `main`. Each PR below gets its own branch named `codex/<slug>`. CI also runs on pushes to `codex/**`.
- Merge one PR at a time with squash, and rebase the next branch on the new `main` before opening it. The ruleset's strict up-to-date policy blocks stale branches.
- Commits and PRs are authored as **Lingikaushikreddy only**. Add no AI co-author trailers and no "generated with" lines.
- Node 24 matches CI. Node 26 cannot run `npm run test:integration` locally; that is a known issue, so ignore it.
- Unit tests: `npm test`. Single file: `node --experimental-strip-types --test tests/<file>.test.mjs`.
- Browser tests: `npm run build && (npm start &) && SETTLEMENT_E2E_URL=http://127.0.0.1:5173 npm run test:e2e`. Before starting, run `pkill -f next-server`; a stale server on 5173 serves an old build and makes every e2e test fail.
- Full local gate before every PR: `npm test && npm run typecheck && npm run lint && npm run build && node scripts/build-scenario-schema-doc.mjs --check && npm run gallery:verify && npm run eval:agent -- --verify public/examples/agent-report.json`.
- Never re-capture the three screenshot baselines in `tests/e2e/visual.spec.ts-snapshots/`. If one fails, your change is wrong.
- Never prune or rewrite CSS with regex tools. Edit CSS by hand and check the built CSS.
- The CLI writes `settlement-agent-report.json` to the cwd by default. Delete any stray copy, because it breaks `tests/custom-scenarios-cli.test.mjs`.

## Global Constraints

- Version after this plan: `0.12.0` (root `package.json`, `packages/settlement-testbed/package.json` and `action.yml`, synced by `npm version`).
- `AGENT_ENGINE_VERSION` and `CUSTOM_AGENT_ENGINE_VERSION` stay unchanged. `public/examples/agent-report.json`, `docs/evaluation-results.json` and `gallery/node-example-rules.json` must verify unchanged.
- New limits: at most **16 scenarios** and **16 custom definitions** per agent report, **160 cases**, **16 rows**, **48 baselines**, **480 baseline cases**. Policy-comparison reports (`npm run evaluate`) keep their 4-scenario limit.
- No new runtime or dev dependencies.
- `MAX_REPORT_BYTES` stays 5 MB.
- The Claude agent never logs the API key, the request body or the claim text.
- Live-model numbers are only ever copied from a verified report. Never estimate or round them up.

## Review Focus

1. **A full-size report with long model answers must stay under 5 MB.** 16 scenarios × 10 seeds with 600-character summaries has to verify and share. Task 5 pins this with a size test.
2. **A 17th scenario must be rejected with a clear message**, not crash later in replay or baselines. Task 5 pins it.
3. **Old reports must keep verifying.** The 0.11.0 reports in `public/examples` and `gallery/` must pass `--verify` unchanged after the caps move. Task 5 pins it through the existing CI step plus `npm run gallery:verify`.
4. **Retries must not outlive the testbed's per-decision timeout.** Three agent attempts at 20 s each can exceed the testbed's default 30 s and get recorded as unanswered. Task 6 caps retries by an overall deadline, and the live-run command passes `--timeout 90000`.
5. **Non-retryable errors (400/401/404) must fail fast.** Retrying a bad key wastes money and time. Task 6 pins it.

---

## PR map

| PR | Branch | Tasks |
| --- | --- | --- |
| 1 | `codex/research-at-scale-plan` | Task 0 |
| 2 | `codex/small-fixes` | Tasks 1, 2, 3 |
| 3 | `codex/building-panel-close` | Task 4 |
| 4 | `codex/sixteen-scenarios` | Task 5 |
| 5 | `codex/claude-agent-retries` | Task 6 |
| 6 | `codex/gallery-claude-haiku` | Task 7 (needs his API key) |
| 7 | `codex/release-0.12.0` | Task 8 |
| — | (repo settings, by him) | Task 9 |

---

### Task 0: Land this plan

**Files:**
- Create: `docs/superpowers/plans/2026-10-12-research-at-scale.md` (this file)

- [ ] **Step 1:** `git checkout main && git pull --ff-only && git checkout -b codex/research-at-scale-plan`
- [ ] **Step 2:** `git add docs/superpowers/plans/2026-10-12-research-at-scale.md && git commit -m "docs(plan): research at scale 0.12.0"`
- [ ] **Step 3:** `git push -u origin HEAD && gh pr create -R Lingikaushikreddy/Settlement-Village --title "docs(plan): research at scale 0.12.0" --body "Implementation plan for 0.12.0: 16-scenario reports, Claude agent retries, first live model report in the gallery, small fixes."`

---

### Task 1: Fix the corrupted schema table in the authoring doc

**Cause (already diagnosed):** `scripts/build-scenario-schema-doc.mjs` passes a *string* to `String.prototype.replace`. The `id` row contains `` `^[a-z][a-z0-9-]{1,39}$` ``, and `` $` `` in a replacement string means "the text before the match". Each run therefore pasted the doc's first 20 lines into the table. `--check` still passes because the corruption is stable. The block between the markers (lines 21–61) is 41 lines instead of 21.

**Files:**
- Modify: `scripts/build-scenario-schema-doc.mjs` (the `doc.replace(...)` line)
- Modify: `docs/scenario-authoring.md` (regenerated)
- Test: `tests/scenario-schema-doc.test.mjs`

**Interfaces:** none. CLI behavior is unchanged (`--check` exits 1 when stale).

- [ ] **Step 1: Write the failing test.** Append to `tests/scenario-schema-doc.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails.** `node --experimental-strip-types --test tests/scenario-schema-doc.test.mjs`. Expected: FAIL with `non-table line in schema block`.
- [ ] **Step 3: Fix the generator.** In `scripts/build-scenario-schema-doc.mjs`, replace the `const next = doc.replace(...)` line with:

```js
// A function replacement: the table contains `$`` (in the id pattern), which a string replacement expands.
const next = doc.replace(/<!-- schema:start -->[\s\S]*?<!-- schema:end -->/, () => `<!-- schema:start -->\n${table}\n<!-- schema:end -->`);
```

- [ ] **Step 4: Regenerate and inspect.** Run `node scripts/build-scenario-schema-doc.mjs`, then `git diff --stat docs/scenario-authoring.md`. Expected: about 20 lines removed and none added. Read `git diff` and check that only the duplicated intro was removed; lines 1–20 above the marker must be unchanged.
- [ ] **Step 5: Run the tests.** `node --experimental-strip-types --test tests/scenario-schema-doc.test.mjs && node scripts/build-scenario-schema-doc.mjs --check`. Expected: PASS, then `schema table is up to date`.
- [ ] **Step 6: Commit** on branch `codex/small-fixes` (create it from `main`): `git add scripts/build-scenario-schema-doc.mjs docs/scenario-authoring.md tests/scenario-schema-doc.test.mjs && git commit -m "fix(docs): stop the schema generator expanding \$\` in the id pattern"`

---

### Task 2: Normalize the package's `bin` path

npm prints `"bin[settlement-testbed]" ... was invalid and removed` on publish because it strips a leading `./`. This is cosmetic, but it shows up on every release.

**Files:**
- Modify: `packages/settlement-testbed/package.json` (`bin`)
- Test: `tests/testbed-package.test.mjs`

- [ ] **Step 1: Write the failing test.** Append to `tests/testbed-package.test.mjs`, adding `readFileSync` to its existing `node:fs` import if it is missing:

```js
test("bin paths are already in npm's normalized form, so publish does not rewrite them", () => {
  const pkg = JSON.parse(readFileSync("packages/settlement-testbed/package.json", "utf8"));
  for (const [name, path] of Object.entries(pkg.bin)) assert.doesNotMatch(path, /^\.\//, `bin ${name} starts with ./`);
});
```

- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/testbed-package.test.mjs`. Expected: FAIL on `bin settlement-testbed starts with ./`.
- [ ] **Step 3:** In `packages/settlement-testbed/package.json`, change `"settlement-testbed": "./dist/testbed/cli.js"` to `"settlement-testbed": "dist/testbed/cli.js"`. Leave `main`, `types` and `exports` unchanged; npm accepts `./` there.
- [ ] **Step 4:** Run `npm run build:package && node --experimental-strip-types --test tests/testbed-package.test.mjs`. Expected: PASS, including the existing test that installs the packed tarball and runs the `bin` link. Then `cd packages/settlement-testbed && npm publish --dry-run --ignore-scripts 2>&1 | grep -c "was invalid" ; cd ../..`. Expected: `0`.
- [ ] **Step 5: Commit:** `git add packages/settlement-testbed/package.json tests/testbed-package.test.mjs && git commit -m "fix(package): write the bin path in npm's normalized form"`

---

### Task 3: Remove dead exports from the research split

**Files:**
- Modify: `components/research/use-local-worker.ts:17` (`export const WORKER_URL`) and `:297` (`export type LocalWorker`)
- Modify: `components/research/use-playback.ts:13` (`export type PlaybackState`)
- Modify: `components/research/observatory.tsx:21` (`export type { ResearchFrame } from "./types";`)

- [ ] **Step 1: Prove each one is unused outside its file.** Run:

```bash
for s in WORKER_URL LocalWorker PlaybackState; do echo "== $s"; grep -rn "\b$s\b" app components lib tests --include=*.ts --include=*.tsx --include=*.mjs | grep -v "components/research/use-local-worker.ts\|components/research/use-playback.ts"; done
grep -rn "ResearchFrame" app components lib tests --include=*.ts --include=*.tsx --include=*.mjs | grep "from \"[^\"]*observatory"
```

Expected: no output for any symbol. If something prints, keep that export and note it in the PR body.
- [ ] **Step 2: Edit.** Drop the `export` keyword from `WORKER_URL` and `PlaybackState`, since both are still used inside their files. Delete the `export type LocalWorker = ReturnType<typeof useLocalWorker>;` line. Delete the `export type { ResearchFrame } from "./types";` line in `observatory.tsx`, keeping the `import type { ResearchFrame }` on line 7.
- [ ] **Step 3: Verify.** `npm run typecheck && npm run lint && node --experimental-strip-types --test tests/component-size.test.mjs tests/research-view-model.test.mjs`. Expected: all pass, and no `noUnusedLocals` error for `PlaybackState`; if one appears, inline the type.
- [ ] **Step 4: Commit:** `git add components/research && git commit -m "refactor(research): drop exports nothing imports"`
- [ ] **Step 5: Open PR 2.** Run the full local gate, then `git push -u origin HEAD && gh pr create -R Lingikaushikreddy/Settlement-Village --title "fix: schema doc table, npm bin path, dead research exports" --body "<one bullet per task with the verification command and its result>"`. Wait for `verify (24)` to pass, then squash-merge.

---

### Task 4: Make the building panel's close button clickable at desktop width

**Known:** `tests/e2e/campaign.spec.ts:29` works around it ("the close button is not clickable at desktop width today"). Playwright never sees the button as stable or hit-testable. The cause is **not** diagnosed. Use superpowers:systematic-debugging and do not guess-fix.

**Files:**
- Test: `tests/e2e/campaign.spec.ts` (the "selects the town hall and reads its panel" test)
- Modify (likely, decided by diagnosis): `components/game/game.css` (`.building-panel` ~747, `.panel-close` ~741 and ~790) or `components/game/polish.css:201`

- [ ] **Step 1: Write the failing test.** Replace the last three lines of "selects the town hall and reads its panel" (the comment and the re-select) with:

```ts
  await panel.getByRole("button", { name: "Close building details" }).click();
  await expect(panel).toHaveCount(0);
  // Re-selecting still toggles the panel.
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  await expect(panel).toHaveCount(0);
```

- [ ] **Step 2: Run it and capture the failure.** `pkill -f next-server; npm run build && (npm start > /tmp/next.log 2>&1 &) && sleep 5 && SETTLEMENT_E2E_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/campaign.spec.ts -g "town hall" --reporter=line`. Expected: FAIL on the click with a timeout. Copy the call log lines `element is not stable`, `<X> intercepts pointer events` or `element is outside of the viewport` into your notes. They tell you which hypothesis holds.
- [ ] **Step 3: Diagnose from the log** (one hypothesis at a time, each with evidence):
  - *intercepts pointer events*: another element (the log names it) sits over the button. Check its `z-index` against `.building-panel { z-index: 14 }`. The fix is to raise the panel's or button's stacking, or to set `pointer-events: none` on the overlay's non-interactive wrapper.
  - *not stable*: something keeps moving the panel, such as a transform, a transition or an ancestor re-render. Check with `await panel.evaluate(el => getComputedStyle(el).transition + ' | ' + getComputedStyle(el).animationName)`. Also check whether the panel re-mounts every game-clock tick; a changing `key` or a component defined inside a render would cause that. A re-mount is a React fix in `components/game/selection-panel.tsx` or `game.tsx`, not a CSS fix.
  - *outside of the viewport*: positioning (`bottom: 185px`, `transform: translateX(-50%)`) at 1280×720 puts the button off-screen or under the footer.
- [ ] **Step 4: Apply the minimal fix** for the cause you proved. CSS edits are by hand and limited to the selectors involved.
- [ ] **Step 5: Verify.** Re-run the Step 2 command and expect PASS. Then run the whole suite: `SETTLEMENT_E2E_URL=http://127.0.0.1:5173 npm run test:e2e`. All tests must pass and the three screenshot baselines must not change; do not use `--update-snapshots`. Also run `node --experimental-strip-types --test tests/stylesheets.test.mjs`.
- [ ] **Step 6: Commit and open PR 3:** `git add tests/e2e/campaign.spec.ts components/game && git commit -m "fix(campaign): building panel close button is clickable at desktop width"`. The PR body states the root cause in one sentence plus the Playwright log line that proved it.

---

### Task 5: Allow 16 scenarios per agent report

**Design:** One constant, `MAX_AGENT_SCENARIOS = 16`, lives in `lib/sim/evaluation.ts`. The testbed already imports from there, so the dependency direction does not change. Every derived limit is computed from it with `MAX_SEEDS = 10` (the existing seed cap) and `BASELINE_POLICIES = 3`. Replay is untouched, so engine versions and old reports do not change.

**Files:**
- Modify: `lib/sim/evaluation.ts` (~line 170–185: the extended manifest's `.max(8)` and the `<= 240` refine)
- Modify: `lib/testbed/run.ts:80-89` (`agentManifestSchema`)
- Modify: `lib/testbed/report.ts:104-107` (`cases .max(80)`, `rows .max(8)`, `baselines .max(24)`)
- Modify: `tests/research-scenarios.test.mjs` (remove `BATCH`/`batches`)
- Test: `tests/custom-scenarios.test.mjs`
- Modify: `docs/research-grounding.md` ("Run them"), `README.md:223` (roadmap line), `CHANGELOG.md` (new `## Unreleased` section)

**Interfaces:**
- Produces: `export const MAX_AGENT_SCENARIOS = 16;` in `lib/sim/evaluation.ts`; `agentManifestSchema` accepts 1–16 scenarios and 0–16 definitions.

- [ ] **Step 1: Write the failing tests.** In `tests/custom-scenarios.test.mjs`, add `readdirSync` to the `node:fs` import, add `import { loadScenarioFile, BUILT_IN_IDS } from "../lib/testbed/index.ts";` (merge it into the existing `../lib/testbed/index.ts` import) and `import { agentManifestSchema } from "../lib/testbed/run.ts";`, then append:

```js
const RESEARCH_DIR = "examples/scenarios/research";
const researchPack = () =>
  readdirSync(RESEARCH_DIR).filter((f) => f !== "sources.json").sort().map((f) => loadScenarioFile(`${RESEARCH_DIR}/${f}`));
const TEN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("the whole research pack plus the built-ins (16 scenarios × 10 seeds) is one verifiable report", async () => {
  const pack = researchPack();
  assert.equal(pack.length, 12);
  const { report } = await evaluateAgent({ source: rejectAll, name: "t", scenarios: [...BUILT_IN_IDS, ...pack], seeds: TEN_SEEDS });
  assert.equal(report.manifest.scenarios.length, 16);
  assert.equal(report.manifest.definitions.length, 12);
  assert.equal(report.cases.length, 160);
  assert.equal(report.rows.length, 16);
  assert.equal(report.baselines.length, 48);
  const verified = await verifyReport(JSON.parse(JSON.stringify(report)));
  assert.equal(verified.ok, true, verified.reason);
});

test("a full-size report with maximum-length answers stays under the 5 MB share limit", async () => {
  const long = async (req) => ({ status: "valid", action: "reject_claim", evidenceIds: req.evidenceIds.slice(0, 10), summary: "x".repeat(600), latencyMs: 1 });
  const { report } = await evaluateAgent({ source: long, name: "t", scenarios: [...BUILT_IN_IDS, ...researchPack()], seeds: TEN_SEEDS });
  const bytes = new TextEncoder().encode(JSON.stringify(report, null, 2)).length;
  assert.ok(bytes < 5 * 1024 * 1024, `report is ${bytes} bytes`);
});

test("a 17th scenario is rejected by the manifest schema", () => {
  const ids = Array.from({ length: 17 }, (_, i) => `custom-${String.fromCharCode(97 + i)}`);
  assert.throws(() => agentManifestSchema.parse({ scenarios: ids, seeds: [1], maxTicks: 60 }));
  assert.doesNotThrow(() => agentManifestSchema.parse({ scenarios: ids.slice(0, 16), seeds: [1], maxTicks: 60 }));
});
```

Check `rejectAll` (line 20 of this file) and the `long` source against the shape `AnswerSource` returns in `lib/testbed/protocol.ts`. If `summary` is capped at `MAX_SUMMARY = 600` there, 600 is the right worst case; if `status`/`latencyMs` are named differently, copy `rejectAll`'s shape exactly. Also check that `maxTicks: 60` is within `tickSchema`. If not, use the default from `lib/testbed/cli.ts` (`--ticks 60`).

- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/custom-scenarios.test.mjs`. Expected: the first two FAIL with a zod "too big" error on `scenarios`/`definitions`; the third FAILS on `doesNotThrow`.
- [ ] **Step 3: Implement.**

`lib/sim/evaluation.ts`: add next to `unique`:

```ts
/** Most scenarios one agent report may hold: the 4 built-ins plus the 12-scenario research pack. */
export const MAX_AGENT_SCENARIOS = 16;
```

In the extended manifest (~line 178), replace `.max(8)` with `.max(MAX_AGENT_SCENARIOS)`, and replace the case refine with:

```ts
    .refine(
      (m) => m.scenarios.length * m.policies.length * m.seeds.length <= MAX_AGENT_SCENARIOS * 3 * 10,
      `Evaluation is limited to ${MAX_AGENT_SCENARIOS * 3 * 10} cases`,
    )
```

`lib/testbed/run.ts`: import `MAX_AGENT_SCENARIOS` from `../sim/evaluation.ts` (add it to the existing import), then use `.max(MAX_AGENT_SCENARIOS)` for `scenarios` and `definitions: z.array(scenarioDefinitionSchema).max(MAX_AGENT_SCENARIOS).optional()`.

`lib/testbed/report.ts`: import `MAX_AGENT_SCENARIOS` from `../sim/evaluation.ts`; cases `.max(MAX_AGENT_SCENARIOS * 10)`, rows `.max(MAX_AGENT_SCENARIOS)`, baselines `.max(MAX_AGENT_SCENARIOS * 3)`.

- [ ] **Step 4: Run the tests.** `node --experimental-strip-types --test tests/custom-scenarios.test.mjs`. Expected: PASS. Then run the old-report checks: `npm run eval:agent -- --verify public/examples/agent-report.json && npm run evaluate -- --verify docs/evaluation-results.json && npm run gallery:verify`. Expected: all verify unchanged.
- [ ] **Step 5: Simplify the research test.** In `tests/research-scenarios.test.mjs`, delete the `BATCH`/`batches` lines and the comment above them. In "the built-in Check evidence policy refuses every attack…", replace the `for (const batch of batches(definitions))` loop with one call: `const { report } = await evaluateAgent({ source: refuse, name: "sanity", scenarios: definitions, seeds: [1, 2, 3] }); baselines.push(...report.baselines);`. Make the same change anywhere else `batches(` is used in that file. Run `node --experimental-strip-types --test tests/research-scenarios.test.mjs`. Expected: PASS.
- [ ] **Step 6: Docs.** In `docs/research-grounding.md`, replace the sentence "A report holds at most four custom scenarios, so the pack runs in four batches; …" and the whole `run() { … }` block plus the paragraph after it with:

````md
One report holds the whole pack. With no `--scenarios`, the testbed runs the four built-ins plus every loaded file, 16 scenarios in all:

```bash
node examples/agents/node/agent.mjs &
files=(); for f in examples/scenarios/research/*.json; do [ "$(basename "$f")" = sources.json ] || files+=(--scenario-file "$f"); done
npx settlement-testbed --agent http://127.0.0.1:8765/decide "${files[@]}" --out research-reports/pack.json
```

A report holds at most 16 scenarios.
````

Run that command with the node example agent and check that it writes a report and that `npx settlement-testbed --verify research-reports/pack.json` (or `npm run eval:agent -- --verify …`) passes. Delete `research-reports/` afterwards; it is not committed. In `README.md:223`, change the roadmap line to `- [ ] Attacks voiced by trusted residents in every family`. In `CHANGELOG.md`, add above `## 0.11.0`:

```md
## Unreleased

- **Whole research pack in one report.** An agent report holds up to 16 scenarios (the four built-ins plus the 12 research scenarios), 160 cases, so `docs/research-grounding.md` runs the pack in one command instead of four batches. Existing reports verify unchanged.
```

- [ ] **Step 7:** Run the full local gate, then commit: `git add lib tests docs README.md CHANGELOG.md && git commit -m "feat(testbed): up to 16 scenarios per agent report"`. Open PR 4 and merge it after CI passes.

---

### Task 6: Claude agent retries transient provider errors within a deadline

A live run sends hundreds of requests. Today a single 429/529 becomes an invalid answer and pollutes the report.

**Files:**
- Modify: `examples/agents/claude/agent.mjs` (`decideLive`, `readConfig`)
- Modify: `examples/agents/claude/README.md` (retry and price notes)
- Test: `tests/claude-example-agent.test.mjs`

**Interfaces:**
- Produces: `export async function decideLive(request, config, deps = {})`, where `deps = { fetchImpl?: typeof fetch, sleep?: (ms) => Promise<void>, now?: () => number }`. `config` keeps its fields (`baseUrl`, `apiKey`, `model`, `timeoutMs`, `prices`). `timeoutMs` now bounds the **whole** decision, all attempts included.
- Retryable statuses: 429, 500, 502, 503, 529. Up to 3 retries. The delay is `retry-after` seconds when present (capped at 10 s), else `500 * 2 ** attempt` ms. A retry never starts if its delay would end past the deadline.

- [ ] **Step 1: Write the failing tests.** Add `decideLive` to the import from `../examples/agents/claude/agent.mjs`, then append:

```js
const goodBody = { stop_reason: "tool_use", content: [{ type: "tool_use", name: "decide", input: { action: "reject_claim", evidenceIds: [], summary: "No." } }], usage: { input_tokens: 10, output_tokens: 5 } };
const reply = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const liveConfig = { baseUrl: "http://stub", apiKey: "k", model: "m", timeoutMs: 20_000, prices: { input: 1, output: 1 } };
const fakeClock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };

test("transient provider errors are retried and the decision succeeds", async () => {
  const statuses = [429, 529, 200];
  const calls = [];
  const clock = fakeClock();
  const fetchImpl = async () => { const s = statuses[calls.length]; calls.push(s); return s === 200 ? reply(200, goodBody) : reply(s, { error: { message: "busy" } }, s === 429 ? { "retry-after": "2" } : {}); };
  const answer = await decideLive(request, liveConfig, { fetchImpl, ...clock });
  assert.equal(answer.action, "reject_claim");
  assert.deepEqual(calls, [429, 529, 200]);
  assert.equal(clock.now(), 2000 + 1000, "retry-after honored, then exponential backoff");
});

test("non-retryable errors fail on the first attempt", async () => {
  for (const status of [400, 401, 404]) {
    let n = 0;
    const fetchImpl = async () => { n++; return reply(status, { error: { message: "nope" } }); };
    await assert.rejects(decideLive(request, liveConfig, { fetchImpl, ...fakeClock() }), new RegExp(`responded ${status}`));
    assert.equal(n, 1, `${status} was retried`);
  }
});

test("retries stop at three and never sleep past the decision deadline", async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return reply(503); };
  await assert.rejects(decideLive(request, liveConfig, { fetchImpl, ...fakeClock() }), /responded 503/);
  assert.equal(n, 4, "one attempt plus three retries");
  let m = 0;
  const slow = async () => { m++; return reply(429, {}, { "retry-after": "10" }); };
  await assert.rejects(decideLive(request, { ...liveConfig, timeoutMs: 15_000 }, { fetchImpl: slow, ...fakeClock() }), /responded 429/);
  assert.equal(m, 2, "the second 10 s wait would pass the 15 s deadline");
});
```

- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/claude-example-agent.test.mjs`. Expected: FAIL, because `decideLive` is not exported.
- [ ] **Step 3: Implement.** Replace `decideLive` in `agent.mjs` with:

```js
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
const MAX_RETRIES = 3;
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One decision through the Messages API. Transient statuses are retried within config.timeoutMs. */
export async function decideLive(request, config, { fetchImpl = fetch, sleep = realSleep, now = Date.now } = {}) {
  const deadline = now() + config.timeoutMs;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(Math.max(1, deadline - now())),
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": config.apiKey },
      body: JSON.stringify(buildMessagesRequest(request, config.model)),
    });
    if (res.ok) return parseProviderResponse(await res.json(), request, config.prices);
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 500 * 2 ** attempt;
    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES && now() + delay < deadline) {
      await res.body?.cancel();
      await sleep(delay);
      continue;
    }
    // The API's error message (never the request or the key) tells the operator why: bad key, unknown model, rejected field.
    const detail = await res
      .text()
      .then((text) => JSON.parse(text.slice(0, 4000))?.error?.message)
      .catch(() => undefined);
    throw new ProviderError(`provider responded ${res.status}${typeof detail === "string" && detail ? `: ${detail}` : ""}`);
  }
}
```

In `readConfig`, change the default `timeoutMs` from `20_000` to `60_000`, since it now covers all attempts. Check the existing call site of `decideLive(request, config)` (in the HTTP handler); it needs no change.

- [ ] **Step 4:** Run `node --experimental-strip-types --test tests/claude-example-agent.test.mjs tests/claude.test.mjs`. Expected: PASS, including the existing dry-run and stderr-once tests.
- [ ] **Step 5: Verify the price constant.** Open Anthropic's current pricing page and find `claude-haiku-5-5` input and output USD per million tokens. If they differ from `DEFAULT_PRICES = { input: 0.1, output: 0.5 }`, update the constant and its comment to `// USD per million tokens for claude-haiku-5-5, from Anthropic's pricing page on <YYYY-MM-DD>`. If you cannot reach the page, leave the value and write in the PR body that he must confirm it. Never guess a price.
- [ ] **Step 6: README.** In `examples/agents/claude/README.md`, add a "Live runs" section covering: transient 429/5xx/529 are retried up to three times within `SETTLEMENT_CLAUDE_TIMEOUT_MS` (default 60000); run the testbed with `--timeout 90000 --concurrency 2` so the testbed's per-decision timeout outlasts the agent's retries; and the cost in a report is an estimate from list prices.
- [ ] **Step 7:** Run the full local gate, then commit: `git add examples/agents/claude tests/claude-example-agent.test.mjs && git commit -m "feat(claude-agent): retry transient provider errors within the decision deadline"`. Open PR 5 and merge it after CI passes.

---

### Task 7: First live model report in the gallery (needs his API key)

**Human step.** Codex must not handle the key. He runs Steps 1–3 in his own terminal; Codex does Steps 4–7 from the report file he leaves in place.

**Files:**
- Create: `gallery/claude-haiku-5-5-research.json` (the report)
- Modify: `gallery/index.json` (append an entry; **append**, because the e2e gallery test reads entry 0)
- Create: `docs/results/2026-10-claude-haiku-research.md`
- Modify: `README.md` (link the result from the research section)

- [ ] **Step 1 (him): Smoke test, about 16 decisions.**

```bash
cd ~/Desktop/Projects/Settlement-Village && git checkout main && git pull --ff-only
export ANTHROPIC_API_KEY=...   # never committed, never pasted into chat
node examples/agents/claude/agent.mjs &
npm run eval:agent -- --agent http://127.0.0.1:8765/decide --name claude-haiku-5-5 --scenarios benign --seeds 1 --timeout 90000 --concurrency 2 --out /tmp/claude-smoke.json
```

Pass criteria: exit code 0, and `node -e 'const r=require("/tmp/claude-smoke.json");console.log(r.totals)'` shows `invalid: 0` and a plausible `selfReportedCostUSD`. If `invalid > 0`, read the agent's stderr: it prints each distinct provider failure once. Fix the cause before going on.

- [ ] **Step 2 (him): Seed-1 pack run (16 cases), to check cost.**

```bash
files=(); for f in examples/scenarios/research/*.json; do [ "$(basename "$f")" = sources.json ] || files+=(--scenario-file "$f"); done
npm run eval:agent -- --agent http://127.0.0.1:8765/decide --name claude-haiku-5-5 "${files[@]}" --seeds 1 --timeout 90000 --concurrency 2 --out /tmp/claude-pack-seed1.json
node -e 'const r=require("/tmp/claude-pack-seed1.json");console.log(r.totals)'
```

Multiply `selfReportedCostUSD` by 10 to estimate the full run. Continue only if he accepts that cost.

- [ ] **Step 3 (him): Full run, 160 cases.** Same command with `--seeds 1-10 --out gallery/claude-haiku-5-5-research.json`. Then `kill %1` to stop the agent and `unset ANTHROPIC_API_KEY`.
- [ ] **Step 4 (Codex): Verify the report and check it is clean.**

```bash
npm run eval:agent -- --verify gallery/claude-haiku-5-5-research.json
node -e 'const r=require("./gallery/claude-haiku-5-5-research.json");console.log(r.totals, r.cases.length, r.manifest.scenarios.length)'
grep -c "sk-ant" gallery/claude-haiku-5-5-research.json   # must print 0
```

Expected: `verified`, `invalid: 0`, 160 cases, 16 scenarios, and 0 key matches. If `invalid > 0`, stop and tell him; do not publish a report with provider failures.

- [ ] **Step 5 (Codex): Gallery entry.** Append to `gallery/index.json`:

```json
  {
    "id": "claude-haiku-5-5-research",
    "title": "Claude Haiku 5.5 (example agent, research pack)",
    "agent": {
      "name": "claude-haiku-5-5",
      "kind": "model",
      "homepage": "https://github.com/Lingikaushikreddy/Settlement-Village/blob/main/examples/agents/claude/agent.mjs"
    },
    "report": "gallery/claude-haiku-5-5-research.json",
    "submittedBy": "Lingikaushikreddy",
    "submittedAt": "<date of Step 3, YYYY-MM-DD>",
    "notes": "The shipped Claude example agent at default settings on the four built-ins and the 12 research scenarios, seeds 1-10. Cost is the agent's own estimate from list prices."
  }
```

If `agent.name` must equal the report's `agentName`, `npm run gallery:verify` will say so; the `--name` in Step 3 already matches. Run `npm run gallery:verify`. Expected: `2 gallery entries verified`.

- [ ] **Step 6 (Codex): Results note.** Print the numbers: `node -e 'const r=require("./gallery/claude-haiku-5-5-research.json");for(const x of r.rows)console.log(x.scenario,x.attackSuccessRate,x.benignRefusalRate??x.honestRefusalRate,x.inspectionCount)'` and print the matching baselines (`r.baselines`, policy `check-evidence` or whatever the Check evidence policy's id is in `lib/sim/types.ts`). Write `docs/results/2026-10-claude-haiku-research.md` with: date, model id, agent commit SHA, command, cost from `totals`, one table (scenario | attack success | honest refusal | inspections | Check evidence baseline) copied exactly from the output, and a "What this does and does not show" section. That section must say: one model at one setting; 10 seeds; claims written for this village; whether each family's hypothesis in `docs/research-grounding.md` held, as a yes or no read straight off the table, with no extrapolation beyond these scenarios. Link the note from the research section of `README.md` and from `docs/research-grounding.md`.
- [ ] **Step 7:** Run `SETTLEMENT_E2E_URL=… npx playwright test tests/e2e/gallery.spec.ts` against a fresh build. Expected: PASS, and the `/gallery` page shows both entries. Then commit `git add gallery docs/results README.md docs/research-grounding.md && git commit -m "feat(gallery): Claude Haiku 5.5 on the research pack"`. Open PR 6 with the results table in the body, and merge it after CI passes.

---

### Task 8: Release 0.12.0

**Files:** `package.json`, `packages/settlement-testbed/package.json`, `action.yml` (via `npm version`), `CHANGELOG.md`, `package-lock.json`

- [ ] **Step 1:** `git checkout main && git pull --ff-only && git checkout -b codex/release-0.12.0`
- [ ] **Step 2:** In `CHANGELOG.md`, rename `## Unreleased` to `## 0.12.0 — <today>` and complete its bullets: the 16-scenario report (from Task 5); "**Claude agent retries.** 429/5xx/529 are retried up to three times within the decision deadline; non-retryable errors fail at once"; "**First model report in the gallery**: Claude Haiku 5.5 on the research pack (`docs/results/…`)"; "Fixes: the scenario-authoring schema table, the npm bin path warning, the building panel close button, unused research exports". End with "Gameplay, the protocol, engine versions and existing reports are unchanged."
- [ ] **Step 3:** `npm version 0.12.0 --no-git-tag-version` (the `version` script syncs the package and `action.yml`), then `npm run check:versions && node scripts/build-package-readme.mjs --check`. If the README check fails, run `node scripts/build-package-readme.mjs` and include the result.
- [ ] **Step 4:** Run the full local gate, then commit `git commit -am "chore(release): 0.12.0"`. Open PR 7 and merge it after CI passes.
- [ ] **Step 5 (him, or Codex with his explicit go-ahead):** `git checkout main && git pull --ff-only && git tag v0.12.0 && git push origin v0.12.0`. `release.yml` creates the GitHub Release from the changelog section and publishes `settlement-testbed@0.12.0` with provenance through trusted publishing.
- [ ] **Step 6: Verify the release.** `gh release view v0.12.0 -R Lingikaushikreddy/Settlement-Village`, `npm view settlement-testbed version` (expect `0.12.0`), and from an empty temp folder `npx settlement-testbed@0.12.0 --verify <path to repo>/gallery/claude-haiku-5-5-research.json` (expect it to verify 160 cases).

---

### Task 9: Make the gallery job a required check (repo setting, him)

The `gallery reports verify` CI job runs, but the ruleset requires only `verify (24)`, so a broken gallery entry could merge.

- [ ] **Step 1:** GitHub → Settings → Rules → Rulesets → "main" (id 24825285) → Require status checks → add `gallery reports verify`. Or ask Codex to prepare the `gh api -X PUT repos/Lingikaushikreddy/Settlement-Village/rulesets/24825285 …` call and review it before it runs. That call replaces the whole ruleset, so it must include every existing rule.
- [ ] **Step 2:** Confirm on the next PR that both checks show as required.

---

## Out of scope (next phase candidates)

- Theo-voiced attacks in every family (removes the speaker confound). This needs new scenario files and a hypothesis update, so it gets its own spec.
- Starting inventories hard-coded in both `lib/sim/scenario-schema.ts` and `createRun` in `lib/sim/engine.ts` (they can drift apart).
- `verify-gallery`'s console ratio is an unweighted mean; replay links always target `main`.
- Runs of other models, or the same model at a different setting.
