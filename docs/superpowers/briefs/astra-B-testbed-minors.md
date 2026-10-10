# Brief B: testbed minors from review

**For:** Astra-6 · **Repository:** https://github.com/Lingikaushikreddy/Settlement-Village · **Branch:** `chore/testbed-minors` from `main` · **One pull request, one commit per item.**

## Rules

- Read `CONTRIBUTING.md`. `main` is protected: open a PR; CI must be green.
- Test first: for each item, add the failing test named below, run it, make it pass, run the whole suite (`npm test`), commit.
- Both reference reports must verify unchanged: `npm run evaluate -- --verify docs/evaluation-results.json` and `npm run eval:agent -- --verify public/examples/agent-report.json`. If either changes, you have changed engine behaviour: revert.
- Do not add dependencies. Do not touch files outside each item's list. No AI attribution lines in commits or the PR.

## Items

### 1. `--scenario-file` shadowing exits 2 with usage

Files: `lib/testbed/cli.ts`, `tests/custom-scenarios-cli.test.mjs`.
Today `createRegistry(definitions)` sits outside the `try` that wraps `loadScenarioFile`, so a file whose `id` is a built-in (or a duplicate file) exits 1 with a bare message. Move the registry creation inside that `try`, keeping the `Invalid scenario file:` prefix.
Test: write a copy of `lib/sim/scenarios/benign.json` to a temp file and run the CLI with `--scenario-file <it>`; expect exit status 2 and stderr matching `/shadows a built-in/` and `/Usage:/`.

### 2. An explicit `scenarios` list wins over `scenarioFiles` in `evaluateAgent`

Files: `lib/testbed/evaluate.ts`, `tests/custom-scenarios.test.mjs`, `docs/agent-testbed.md` ("Use it as a library" sentence).
Today ids loaded from `scenarioFiles` are appended even when `scenarios` is explicit. Change: when `options.scenarios` is given, run exactly those ids (strings must resolve in the registry, which still includes the loaded files); when it is omitted, run the four built-ins plus every loaded file. Document the rule in one sentence.
Test: `evaluateAgent({ source, scenarios: ["injection"], scenarioFiles: [tempFileWithIdUrgency] })` produces a report whose `manifest.scenarios` is exactly `["injection"]` and whose manifest has no `definitions`; the same call without `scenarios` produces `["scarcity","reputation","injection","benign","urgency"]`.

### 3. Mismatched `harm` and `acceptMeans` are rejected by the schema

Files: `lib/sim/scenario-schema.ts`, `tests/scenario-schema.test.mjs`, `docs/scenario-authoring.md` (one sentence under "How the rules interact"), `scripts/build-scenario-schema-doc.mjs` (the `harm` row's meaning).
Rule: `acceptMeans: "refuse_proposer"` requires `harm.type` `lost_trade` or `none`; `acceptMeans: "trade_with_proposer"` requires `harm.type` `overpay` or `none`. Implement as a `superRefine` issue at path `["harm"]` with a message naming both fields. All four built-ins and both `examples/scenarios/*.json` already satisfy it.
Test: `parseScenarioDefinition({ ...scarcity, harm: { type: "lost_trade", amount: 2 } })` throws matching `/harm/`; `parseScenarioDefinition({ ...reputation, harm: { type: "overpay", reference: 2 } })` throws; the four built-ins and the two example files still parse.

### 4. `offer.give` is bounded by the proposer's starting inventory

Files: `lib/sim/scenario-schema.ts`, `tests/scenario-schema.test.mjs`, `docs/scenario-authoring.md` ("Limits" paragraph).
Starting inventories in `lib/sim/engine.ts` `createRun`: every resident has `grain 6, wood 3, water 5, coins 30`; Rook (the chaos agent) has `grain 30, wood 3, water 5, coins 30`. Add a `superRefine` that rejects an `offer.give` amount above the proposer's starting stock for that resource (`rook` → grain 30 / wood 3 / water 5 / coins 30; `theo` → grain 6 / wood 3 / water 5 / coins 30), with a message naming the resource and the limit. Document the limits.
Test: `{ ...scarcity, offer: { give: { grain: 31 }, receive: { coins: 6 } } }` throws matching `/grain/`; `{ ...reputation, offer: { give: { grain: 7 }, receive: { coins: 2 } } }` throws; the built-ins parse.

### 5. `action.yml` `node-version` wording

Files: `action.yml`.
The input description says "to set up if none is present" but `setup-node` always runs. Change the description to: `Node version the action sets up before running the testbed (default 22).` No test; CI's action self-test covers the file.

### 6. CI self-test readiness probe

Files: `.github/workflows/ci.yml` (the `action` job's "Start the example agent" step only).
The loop POSTs an empty body, which the example agent answers with 400, so `curl -sf` never succeeds and the loop always waits its full 10 s. Replace the body with a minimal valid request so the loop exits early:
`curl -sf -o /dev/null -X POST -H 'content-type: application/json' -d '{"protocol":1,"caseId":"c_0","decisionId":"d","tick":1,"you":{"id":"mira","name":"Mira","occupation":"Farmer"},"observation":{},"claim":"x","actionMeaning":"x","allowedActions":["reject_claim"],"evidenceIds":[]}' http://127.0.0.1:8765/decide && break`.

### 7. Player guide points at `npx settlement-testbed`

Files: `docs/player-guide.md` (the "Test an external agent" paragraph).
Replace the sentence that says to run `npm run eval:agent -- --agent <url> --name <label>` from the repository with: run `npx settlement-testbed --agent <url> --name <label>` (no clone needed), or `npm run eval:agent -- …` from a clone. Keep the rest.

## Acceptance

- `npm test`, `npm run test:integration`, both verifications, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, `npm run build:package && npm run check:package`, `node scripts/build-scenario-schema-doc.mjs --check`, `node scripts/build-package-readme.mjs --check` all pass (regenerate the two generated docs with `node scripts/build-scenario-schema-doc.mjs` and `npm run docs:package-readme` after editing their sources).
- PR title: `chore: testbed polish from review (scenario-file exit code, explicit scenarios, schema refines, probe, docs)`. One bullet per item in the PR body with the test name that covers it.
