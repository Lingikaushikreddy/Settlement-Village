# Optional live model decisions

Settlement is free by default. Village, Council, browser experiments and policy comparisons require no model key. This integration lets you explicitly ask Claude to choose the next pending social action in a **paused local worker experiment**. It does not automate the campaign or modify village treasury.

## Configure the local worker

Use Node 24 or newer. Configure these environment variables in the shell that starts `npm run worker` (or `npm run dev:all`). The worker reads process environment; it does not automatically load a `.env` file.

| Variable | Value |
| --- | --- |
| `SETTLEMENT_LIVE_AI` | `true` to opt in; disabled otherwise |
| `ANTHROPIC_API_KEY` | Your server-side provider key |
| `SETTLEMENT_CLAUDE_MODEL` | A tool-capable model ID available to your provider account |
| `SETTLEMENT_CLAUDE_INPUT_USD_PER_MTOK` | Current input price in USD per million tokens |
| `SETTLEMENT_CLAUDE_OUTPUT_USD_PER_MTOK` | Current output price in USD per million tokens |
| `SETTLEMENT_AI_DAILY_BUDGET_USD` | Positive daily limit; defaults to `1` |

Restart an already-running worker after updating code or changing these settings. All prices must be positive finite numbers. Select the model and rates from your provider account. Do not enter keys into the browser or commit them to source control. The worker remains on `127.0.0.1:8787`; browser access is allowed from `http://localhost:5173` and `http://127.0.0.1:5173` only.

The adapter uses a user-defined tool with a JSON schema for allowed actions and cited evidence, following [Claude tool definitions](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools). Only accept, reject, or check the current claim is permitted; world execution still validates resources and consent.

## Use it

1. Start the app and configured worker. Open **Research → New experiment → Create on local worker**.
2. Keep playback paused. Advance to tick 8, where the first claim arrives.
3. Read **Live model decisions**. It reports disabled, missing configuration, or ready status without exposing the key.
4. Click **Ask Claude to decide next tick**. This sends the recipient's permitted observation, visible evidence IDs and permitted actions to Anthropic. Each click can incur API cost.
5. Inspect the recorded proposal, the actual executed result, token usage and estimated cost. Continue with free steps or explicitly request another model step when another decision is pending.
6. Save/export the run and use **Verify replay**. Replay consumes recorded proposals and never contacts the provider.

The input omits private evidence belonging to other residents and privileged incident labels. This does not establish general prompt-injection robustness; decisions remain experimental.

## Persistence and spending

Before dispatch, SQLite reserves a conservative cost estimate: one input token per UTF-8 byte plus 4,000 tokens of overhead, and up to 256 output tokens. A maximum of six attempts per run and twenty per UTC day apply. The normalized response is persisted before committing the world transition. Duplicate request IDs return the prior result, stale versions fail, and competing commands are blocked while a request is pending.

Reservations are retained for the day, even after a cheaper success, provider failure or interrupted process. The daily meter uses the greater of reservation and recorded actual cost for each request. This can stop requests earlier than actual usage would require. The bound depends on correctly configured prices and token estimates; use the provider's own account spending controls too.

On failure no model action is applied and the run stays paused. You may use the free step button. Interrupted requests never retry automatically; after a worker restart their reservation remains and the failure is recorded. A new explicit request ID may spend again. Exports include successful applied proposals and usage; failed attempts and normalized responses remain in the local SQLite request ledger.

Free runs retain engine version `1.1.0`. Model-assisted runs use `1.1.0+social-1`; verification supports both. Decision summaries are auditable output, not hidden model reasoning. Trust dispositions and Chaos claim opportunities remain authored.

## Validation

Automated tests inject provider responses for success, invalid evidence, replay, limits, conflicts, duplicates, errors and restart behavior. HTTP tests check origin rejection and disabled mode. No live paid provider call was made during development. A real provider smoke test remains necessary after you supply a key, model and current prices.
