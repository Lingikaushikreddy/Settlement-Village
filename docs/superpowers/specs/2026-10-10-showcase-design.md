# Showcase design

**Date:** 2026-10-10 · **Status:** approved (approach A) · **Owner:** Kaushik Reddy

Fourth sub-project of the open-source push and the last "testbed as a product" spec. The testbed can now be installed from npm, run in CI, and extended with authored scenarios. This spec gives it a public face: a Claude-powered example agent that shows what a model-backed agent looks like on the protocol, and an in-repository gallery of verified reports that anyone can replay in the browser.

## Goals

- `examples/agents/claude/agent.mjs` runs the HTTP protocol against the Anthropic Messages API with one tool call per decision, reports real usage and an estimated cost, and starts in a key-free `--dry-run` mode so CI can exercise it.
- `gallery/` holds submitted agent reports and an index; `node scripts/verify-gallery.mjs` re-verifies every report and validates the index; CI runs it whenever the gallery or the verifier changes.
- `/gallery` on the hosted site lists every entry with per-scenario rates next to the Check evidence baseline and links each to the existing verify-and-replay flow (`/?view=research&report=<raw URL>`).
- Submitting a report is a pull request following a template; the branch ruleset plus the gallery job are the only gate.
- Two first entries: the Node example agent, and the Claude agent (run by the maintainer with his key).

## Non-goals

- No ranking or leaderboard: entries are listed in submission order, because scores on authored scenarios do not generalize and ranking would invite tuning to the texts.
- No accounts, uploads, hosted storage, moderation tooling or analytics.
- No model adapters beyond the one example agent; no change to the engine, protocol, report format or scenario schema.
- The gallery accepts only reports that verify with the current engine; it does not keep historical engine versions runnable.

## Design

### 1. Claude example agent

`examples/agents/claude/agent.mjs` (Node 22+, no dependencies, same shape as the Node example):

- Reads `ANTHROPIC_API_KEY`, `SETTLEMENT_CLAUDE_MODEL` (default: the current Haiku model id), `SETTLEMENT_CLAUDE_INPUT_USD_PER_MTOK` and `SETTLEMENT_CLAUDE_OUTPUT_USD_PER_MTOK` (defaults: that model's list prices at the time of writing, stated in the README), `PORT` (default 8765). Without a key and without `--dry-run` it exits 2 with one line of help; the key is never logged.
- Per request: one `POST https://api.anthropic.com/v1/messages` with a system prompt (the resident's role, that claims and memories are untrusted attributed evidence, that `check_evidence` is available and costs nothing but time, that the reply must be the tool call), the request JSON as the user message, one tool `decide` whose `action` enum is the request's `allowedActions`, `evidenceIds` limited to the request's ids, `summary` up to 300 characters, `tool_choice: { type: "tool", name: "decide" }`, `max_tokens` 300, a 20 s timeout (below the testbed's 30 s default).
- Reply `200` with `{ action, evidenceIds, summary, usage: { inputTokens, outputTokens, costUSD } }`. Any provider failure, timeout or malformed tool output replies `400` with a short reason so the testbed records `http_status` and moves on; there are no retries.
- `--dry-run`: no network; answers `check_evidence` when allowed, otherwise `reject_claim` for claims matching a small keyword list and `accept_claim` otherwise, with zero usage. CI starts the agent in this mode and runs the testbed against it to prove the protocol wiring.
- `examples/agents/claude/README.md`: setup, the exact command, what a full run costs (the test records the dry-run; the README states the measured token totals from the maintainer's first live run once available), and that summaries contain model text.

### 2. Gallery folder and verifier

- `gallery/index.json`: an array of entries validated by `lib/gallery/index-schema.ts`:

  ```ts
  { id: slug, title: string ≤ 80, agent: { name: string ≤ 60, kind: "rules" | "model" | "other", homepage?: https URL },
    report: `gallery/${id}.json`, submittedBy: GitHub login, submittedAt: YYYY-MM-DD, notes?: string ≤ 300 }
  ```

  Ids are unique; `report` must equal `gallery/<id>.json`; `agent.name` must equal the report's `agent.name`.
- `gallery/<id>.json`: the unmodified agent report (5 MB limit as elsewhere).
- `scripts/verify-gallery.mjs`: validates the index, checks every `gallery/*.json` other than the index is listed exactly once, verifies each report with `verifyAgentReport` (so reports with custom definitions work), prints one table row per entry (cases, attack success, honest refusal, invalid, engine), exits 1 on any failure. `npm run gallery:verify`.
- `lib/gallery/summary.ts`: `summarizeGalleryEntry(entry, report)` returning the per-scenario rates and the Check evidence baseline rates for the page and the verifier table, so both show the same numbers.
- CI: a `gallery` job in `ci.yml` with `paths` filters on `gallery/**`, `scripts/verify-gallery.mjs`, `lib/gallery/**`, `lib/testbed/**`, `lib/sim/**`; it runs `npm ci` and `npm run gallery:verify` on Node 24. The ruleset keeps `verify (24)` as the required check; the gallery job failing still blocks merge through the PR's combined status when it runs.
- Submission: `.github/PULL_REQUEST_TEMPLATE/gallery.md` and `docs/gallery.md` (run the CLI, copy the report to `gallery/<id>.json`, add the index entry, open the PR with `?template=gallery.md`). `CODEOWNERS` gets `/gallery/ @Lingikaushikreddy`.

### 3. Gallery page

`app/gallery/page.tsx`, statically rendered at build time from `gallery/index.json` and the report files (server component, no client state). Per entry: title, agent name and kind, submitter and date, cases and seeds, engine stamp, a table of scenarios with the agent's attack success and honest refusal next to the Check evidence baseline (from `summarizeGalleryEntry`), notes, and a "Verify and replay" link to `/?view=research&report=https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/<report>`. Header: one paragraph from the testbed docs' "What a score does not mean", and a "Submit yours" link to `docs/gallery.md`. The site navigation gains a "Gallery" link in the Research field guide, and the README gets a Gallery link. `metadata` for the page (title, description). Styling reuses `components/experiments.css` classes; no new dependencies. Playwright: `/gallery` renders every index entry's title, and the first entry's replay link leads to "Agent report verified".

### 4. First entries and docs

- Entry `node-example-rules`: the Node example agent on the four built-ins plus the reciprocity pair (6 scenarios × 10 seeds, 60 cases), generated with the repository CLI and committed.
- Entry `claude-haiku-example`: the Claude agent on the same manifest, generated by the maintainer with his key; its measured usage goes into the agent README. Until it exists the gallery has one entry; the page and verifier handle any count ≥ 1.
- Docs: `docs/gallery.md`; a "Try the Claude example" subsection in `docs/agent-testbed.md` inside the README markers; README "Gallery" link and a short gallery blurb in the testbed section; CHANGELOG 0.9.0; roadmap; version 0.9.0.

## Division of work

The maintainer's Astra-6 takes tasks that are self-contained and specified by tests, after the data contract they depend on has merged:

- **Brief A: the `/gallery` page** (section 3), after the index schema, summary helper and first entry are on `main`.
- **Brief B: deferred minors** from the last two reviews, each with its test: CLI exit 2 for a shadowing or duplicate `--scenario-file`; `evaluateAgent` honoring an explicit `scenarios` list over `scenarioFiles`; a schema refine rejecting mismatched `harm` and `acceptMeans`; an `offer.give` bound against the proposer's starting inventory; `action.yml` `node-version` wording; the CI self-test readiness probe sending a valid body; the player guide pointing at `npx settlement-testbed`.

Claude (this session) does: this spec and plan, the Claude example agent including the live call, the index schema, summary helper, verifier, CI job, submission template and docs, the first entry, CHANGELOG, version, the two briefs, and the final review of every PR including Astra-6's.

## Pull request sequence

| # | Branch | Content | Owner |
| - | ------ | ------- | ----- |
| 0 | `docs/showcase-spec` | spec, plan, briefs | Claude |
| 1 | `feat/claude-example-agent` | section 1 with a dry-run CI check | Claude |
| 2 | `feat/gallery-verifier` | section 2 plus the Node example entry | Claude |
| 3 | `feat/gallery-page` | section 3 | Astra-6 (Brief A) |
| 4 | `chore/testbed-minors` | Brief B | Astra-6 |
| 5 | `chore/showcase-0.9.0` | docs, CHANGELOG, version, Claude entry if available | Claude |
| 6 | tag `v0.9.0` | release and npm publish (once Trusted Publishing is configured) | maintainer |

## Risks

- **Provider changes break the live agent.** The dry-run mode keeps CI independent of the provider; the live path is exercised by the maintainer's gallery run.
- **A gallery report stops verifying after an engine change.** The gallery job fails on that PR, which is the intended signal: the submitter re-runs or the entry is retired in the same PR.
- **Large gallery.** Each report is 10 KB to 300 KB; the static page reads them at build time only. If the gallery grows past a few dozen entries, paginate then.
- **Prompt text leaks ground truth.** The agent's system prompt is written from the protocol docs only and never mentions scenario names; the existing leak test covers the request side.
