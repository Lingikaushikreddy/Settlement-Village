# Changelog

## 0.4.0 — 2026-09-30

- **Agent testbed:** `npm run eval:agent -- --agent <url>` runs your own agent through the authored deception scenarios and honest controls over a small HTTP protocol, with any language or framework.
- Requests never reveal the scenario, seed or whether a claim is an attack; case IDs are salted per run.
- Timeouts, errors and malformed answers are recorded as invalid and never earn credit. Unanswered honest offers count as refused.
- Reports place your agent next to the three built-in policies, store every answer, and verify independently (`--verify`) by rebuilding each case.
- Research → Compare imports agent reports, replays any case on the map with the agent's reasoning, and opens share links from GitHub raw or Gist URLs.
- Node and Python example agents, and a verified sample report in `public/examples/`.
- Comparisons and verifications no longer stall in background tabs: evaluation yields through message events instead of throttled timers.

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

Campaign agents use deterministic policies. Multiplayer, arbitrary natural-language goals, autonomous construction and model-driven campaign decisions are not included.
