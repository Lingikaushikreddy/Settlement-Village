# Settlement

A living village where you can inspect agent decisions, challenge trust, and replay the evidence behind each outcome.

## Run it

Use Node 24 or newer and npm. The application also passed its tests on the Node 23.9 runtime available during development, which prints experimental SQLite/type-stripping warnings.

```bash
npm ci
npm run dev:all
```

Open `http://localhost:5173`. The website works without the worker; `npm run dev` starts just the interface. The worker listens only on `127.0.0.1:8787` and stores runs in `work/settlement.sqlite`.

## Try the complete flow

1. Open **Research** in the village navigation. It begins with your current chapter record. Use **Archive → Included reference run → Open replay**, then **Find an incident** to reach tick 8 of The Missing Grain.
2. Advance one tick. Select the targeted resident and inspect its decision and evidence.
3. Open **Compare**, select a scenario, first seed, seed count and run length, then run a policy comparison. Honest-offer controls reveal the cost of indiscriminate refusal. Inspect an included seed or export the JSON report/CSV table. Import or paste JSON to reproduce its recorded cases. See [Evaluation reports](evaluation-reports.md).
4. Create a browser simulation or, when the local worker is running, choose **Create on local worker**.
5. Play, pause, single-step, and queue interventions. Publish verified stock to change the social decisions.
6. Save a run, open it from the library, export JSON, and verify its deterministic replay.

Browser simulations advance while the page is open. Worker simulations continue independently and survive process restarts; use **Archive → On your local worker** to reconnect. The hosted site provides recorded playback, browser simulations, comparisons, and browser-local saved runs. It does not silently route visitors to a shared hosted simulation worker.

## What is implemented

- Six residents, one Chaos actor, five locations, integer grain/wood/water/currency balances.
- Bounded state-space planning with preconditions, source depletion, and a six-step/200-expansion limit.
- Immutable trade offers with identified recipient, fixed terms, expiry, and atomic acceptance.
- Actor-scoped memories, attributed claims, explicit observations, and a spectator inspector.
- Three adversarial scenario families plus honest-offer controls; three deterministic policies.
- Seeded priority order, per-tick state snapshots, audit events, decision summaries, and replay comparison of state and evidence.
- Incident detection, harm, resistance, unresolved outcomes, and honest-offer refusal counts.
- Responsive map, keyboard-accessible controls, reduced motion, saved runs, and exports.
- Local SQLite worker with transactional commits, durable idempotency receipts, revision checks, run limits, origin/host checks, and SSE snapshots on reconnect.
- Optional, disabled Claude proposal adapter with action/evidence validation, call-limit prechecks, timeout, and usage reporting.

## Architecture

```mermaid
flowchart LR
  UI[Village interface] --> Core[Deterministic engine]
  UI -->|local only HTTP controls| Worker[Persistent Node worker]
  Worker --> Core
  Worker --> DB[(SQLite)]
  Worker -->|SSE committed snapshots| UI
  Core --> Evidence[Events, decisions, incidents]
  Core --> Planner[Bounded planner]
  Eval[Matched-seed evaluator] --> Core
```

`lib/sim` owns world transitions and evaluation. `components` owns presentation. `worker` owns persistence and scheduling. The Next-compatible Sites starter hosts the interface. No provider calls or keys run in browser code. Explicit optional model steps run in the local Node worker.

## Verify

```bash
npm test
npm run typecheck
node --test tests/http.integration.mjs
npm run evaluate
npm run evaluate -- --verify docs/evaluation-results.json
npm run build
```

The test suite covers conservation, trade consent, conflicting offers, duplicate commands, bounded planning, hidden stock isolation, replay tampering, same-tick evidence, mechanical failure accounting, and worker recovery. The HTTP integration test uses a temporary database and local port 8899; it verifies origin rejection, controls, autonomous ticking, and the event stream.

`docs/evaluation-results.json` contains a versioned compact report for 120 deterministic runs: four scenario families × three policies × ten seeds. It records each configuration, metrics, tick checksums and evidence checksum, alongside aggregate rows. All runs check invariants and exact replay. Verification regenerates every case with the matching engine and rejects any mismatch. Results are specific to authored scenarios and rules; they are not a general safety benchmark. The evidence policy is intentionally suited to these inspectable scenarios.

## Important design limits

- This is a functioning first release, not full implementation of every v3 ambition. PostgreSQL/Drizzle persistence, distributed worker fencing, production authentication, true multi-model experiments, semantic retrieval, and player-resident mode remain outside this release.
- Model calls are disabled by default. Explicit steps on paused worker experiments can use configured Claude decisions with durable response records and conservative spend reservations. Automatic playback and matched comparisons use the free policy. See [Live model setup](live-models.md). The paid provider has not been contacted during development; tests inject provider responses.
- Chaos messages and opportunities are scenario-authored. Residents are autonomous under bounded deterministic policies; Rook is not an open-ended generative attacker.
- Unvisited food sources use an explicit prior of four available grain. The planner never reads hidden remote stock, and actions revalidate at execution. Replanning can replace an optimistic plan after observing depletion.
- Social evidence checks use scenario-specific facts. Reputation harm is a two-coin opportunity-cost score, not money transferred. Injection/false-scarcity harm is the excess paid over the two-coin reference price.
- Checksums detect accidental changes; they are not cryptographic signatures. Verification reconstructs the run and compares state and audit evidence. Exports require the matching engine version.
- SQLite is for one local owner and one worker process. The worker is intentionally loopback-only with a 100-run limit and three simultaneous active runs. Do not expose it publicly. Browser storage can be evicted; export valuable runs.

## Optional worker configuration

- `SETTLEMENT_DB`: database path (default `work/settlement.sqlite`).
- `SETTLEMENT_WORKER_PORT`: port (default `8787`; the UI currently connects to that default).

A process lock prevents concurrent workers from owning the same database. Graceful shutdown removes it. After an unclean shutdown, a verifiably dead PID can be recovered automatically; if OS permissions prevent checking it, stop the old worker and inspect the lock before restarting.

## References

The village concept draws on [Generative Agents](https://arxiv.org/abs/2304.03442) and [AI Town](https://github.com/a16z-infra/ai-town). Planning is informed by [Jeff Orkin’s GOAP presentation](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf). Worker storage uses the [Node SQLite API](https://nodejs.org/api/sqlite.html). The optional adapter follows [Claude tool-use documentation](https://platform.claude.com/docs/claude/docs/tool-use).
