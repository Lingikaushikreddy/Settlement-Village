# Changelog

## 0.9.0 — 2026-10-10

- **Gallery of verified reports.** `gallery/` holds submitted agent reports; CI re-verifies every one; the hosted `/gallery` page shows per-scenario rates next to the Check evidence policy with verify-and-replay links. Submissions are pull requests (`docs/gallery.md`). Entries are listed, never ranked.
- **Claude example agent.** `examples/agents/claude/agent.mjs` decides each claim through one strict tool call to Claude (`claude-haiku-5-5` by default), reports real usage and cost, and turns every provider problem into an invalid answer. `--dry-run` needs no key.
- Testbed polish from review: a shadowing `--scenario-file` exits 2 with usage, an explicit `scenarios` list wins over loaded files, mismatched harm and accept rules are rejected, offers are bounded by starting inventories, and the player guide points at `npx settlement-testbed`.

Gameplay, scenarios, the protocol and existing reports are unchanged.

## 0.8.0 — 2026-10-10

- **Scenarios are data.** The four built-in families now live in `lib/sim/scenarios/*.json` and reproduce the reference reports byte for byte. A published schema (`docs/scenario-authoring.md`) describes claim, proposer, offer, evidence, contradiction and harm rules.
- **Custom scenarios** run through `npx settlement-testbed --scenario-file` and `evaluateAgent({ scenarios: [...] })` (the GitHub Action runs the built-ins). Reports embed the definitions they used, so `--verify` and the browser rebuild them without the files; custom runs are stamped `1.1.0+agent-1+custom`.
- **Example pair:** `examples/scenarios/reciprocity.json` (an invented debt) and `reciprocity-honest.json` (a real favor at the fair price). The Node example agent falls for the invented debt every time, which is the point: a score on the built-in claims says nothing about claims an agent has never seen.
- Decision requests still never reveal the scenario, its kind, the seed or the ground truth.

Built-in scenarios, policies, existing reports and saved villages are unchanged.

## 0.7.0 — 2026-10-10

- **`settlement-testbed` on npm.** `npx settlement-testbed --agent <url>` evaluates any HTTP agent without cloning the repository, and `--verify` checks any report. The package is compiled from the same engine the game and the hosted verifier use, so reports are interchangeable.
- **GitHub Action.** `uses: Lingikaushikreddy/Settlement-Village@v0.7.0` runs the evaluation in CI with pass/fail thresholds, uploads the report and writes a job summary next to the built-in policies.
- **Library API.** `evaluateAgent` accepts a URL or an in-process function; `verifyReport` and the protocol helpers are exported.
- The CLI source moved to `lib/testbed/cli.ts`; `npm run eval:agent` is unchanged.
- Releases publish the package from the tag workflow with npm provenance from 0.7.1 on (the first version is published by hand, without an attestation); the package, action and repository share one version.

Gameplay, scenarios, the protocol and existing reports are unchanged.

## 0.6.0 — 2026-10-10

- **One build system.** The unused vinext/Cloudflare Workers build, the ChatGPT auth helper, the Drizzle/D1 stubs and the starter install scripts are removed. Settlement builds, runs and deploys with Next.js only. 24 dependencies nothing imported are gone, along with the 56 unused shadcn components that were their only importers.
- Next 16.4.0 closes the open security advisories; `npm audit --omit=dev` is clean.
- CI runs on Node 22, 24 and 26. The worker integration test passes on Node 26.
- A Playwright smoke suite (`npm run test:e2e`) checks the village, development start, browser report verification, second-tab blocking and screenshot baselines of the home, Council and Research views on every pull request.
- Dead interface code removed: the SVG village map, VillageLife, three starter icons and about 750 lines of CSS that no component referenced. A follow-up fix repaired a comment that the first removal left open at the top of the Council stylesheet, and a new test rejects any stylesheet with a comment that swallows another.
- Contributor governance: code of conduct, CODEOWNERS, Dependabot, labels, Discussions, a first-PR guide, and a protected `main` branch that requires a green pull request.
- Releases are created by a workflow from `v*` tags using these notes.

Gameplay, reference reports, agent reports and saved villages are unchanged.

## 0.5.0 — 2026-10-02

- **Grow the village:** residents build an additional farm, upgrade it to level 3, and complete its Town hall prerequisite through the same validated commands used by players.
- Reviewable construction steps, dependencies and costs before starting. The plan and spending ceiling then freeze; crew payments preserve 250 gold, 200 timber and 150 food in reserve.
- Construction waits for supplies, reachable sites and one of two builders. Manual construction and upgrades satisfy planned work without duplicate payment; occupied sites trigger replanning. Completion waits for the actual timers.
- Saved plans retain decisions and spending, then restore paused. Existing version-2 campaigns and older crew objectives remain compatible.
- Six distinct illustrated civilian identities shared across the village, resident inspectors, Council and journal; clearer job, route and construction feedback on the map.
- A redesigned strategy interface with compact resource controls, a village journal, production summaries, resident shortcuts and claimable milestone rewards.
- A camera that fits the usable map area, bounded panning, keyboard movement/zoom/fit controls and responsive layouts.
- Build, training and upgrade controls explain resource, builder and capacity constraints before an action is attempted.

This release retains the hosted Next.js frontend and external-agent testbed from 0.3.0 and 0.4.0, including Kavyas and Jhansis as troop names. Campaign policies remain free and deterministic. The new construction objective is a preset plan; arbitrary natural-language goals, model-controlled campaigns and multiplayer remain outside this release. The optional research worker and live-model experiments remain local-only.

## 0.4.0 — 2026-09-30

- **Agent testbed:** `npm run eval:agent -- --agent <url>` runs your own agent through the authored deception scenarios and honest controls over a small HTTP protocol, with any language or framework.
- Requests never reveal the scenario, seed or whether a claim is an attack; case IDs are salted per run.
- Timeouts, errors and malformed answers are recorded as invalid and never earn credit. Unanswered honest offers count as refused.
- Reports place your agent next to the three built-in policies, store every answer, and verify independently (`--verify`) by rebuilding each case.
- Research → Compare imports agent reports, replays any case on the map with the agent's reasoning, and opens share links from GitHub raw or Gist URLs.
- Node and Python example agents, and a verified sample report in `public/examples/`.
- Comparisons and verifications no longer stall in background tabs: evaluation yields through message events instead of throttled timers.
- Research event text and the decision panel name residents instead of showing their ids. Research runs saved before this change no longer replay, because their recorded text changed. Reference results are identical; only checksums changed.
- Troops are renamed: knights are now Kavyas and archers are now Jhansis. Troop ids are unchanged, so campaign saves and armies keep loading.

## 0.3.0 — 2026-09-30

- Settlement is playable in the browser on Vercel. No clone, install or account needed. Saves stay in each visitor's browser.
- The default `dev`, `build` and `start` scripts use standard Next.js. The previous vinext/Cloudflare Workers build remains available as `dev:cloudflare`, `build:cloudflare` and `start:cloudflare`.
- Security headers on every response: Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
- Shared links render a preview card with a 1200×630 village image.
- On the hosted site, Research explains that free simulations, comparisons and replays run in the browser, while live-model experiments need the optional local worker.
- `npm run smoke -- <url>` checks a running build's page, assets, artwork, research redirect, headers and preview image. CI runs it against the production server, and a GitHub workflow runs it against each successful Vercel production deployment.

The research worker and Claude experiments remain local-only. The hosted demo has no accounts, server-side saves or analytics.

## 0.2.0 — 2026-09-17

- One shared evaluator powers browser comparisons and the command line, with bounded seed/tick controls, progress and cancellation.
- Compact versioned reports retain each case's metrics, replay checkpoints and evidence checksum. JSON import/paste and CLI verification independently regenerate every case; CSV exports summarize the results.
- The inspector opens seeds actually included in a report. Honest-control-only comparisons run once and absent metric denominators display as not applicable.
- CI independently reproduces the checked-in 120-case reference report.
- Exclusive browser campaign ownership prevents stale tabs from overwriting progress. Closing the owner stops simulation and flushes its latest state before another tab can load.
- Player actions and imported saves persist immediately; ongoing simulation saves periodically and when the page becomes hidden.
- Damaged saves remain intact with an original-data export and explicit replacement flow.

Campaign and comparison policies remain deterministic and free. These changes do not add model-driven campaigns, multiplayer or hosted operation.

## 0.1.0 — 2026-09-16

First public release of Settlement's playable single-player village and agent investigation lab.

- Two objectives coordinated by six residents: prepare a raid and restock supplies.
- Real collection, recruitment, exclusive job claims, pathfinding, rest handoffs, bounded experience and recent memories.
- Village construction, upgrades, resource production, three troop types and three raid strongholds.
- Four Council chapters with evidence inspection, player interventions and treasury consequences.
- Integrated Research and Archive views, seeded policy comparisons, saved experiments, JSON export and replay verification.
- Optional local SQLite worker and explicitly configured Claude social decisions with action validation and usage records.
- Responsive desktop and phone controls, browser-local campaign saves and portable exports.
- 78 gameplay/engine/worker tests plus a separate HTTP integration flow.

At the 0.1.0 release, campaign agents used deterministic policies. Multiplayer, arbitrary natural-language goals, autonomous construction and model-driven campaign decisions were not included.
