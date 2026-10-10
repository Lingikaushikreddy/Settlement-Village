# Claude example agent

A Settlement test agent that asks Claude to decide each claim through one tool call. Zero dependencies, Node 22 or newer.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node examples/agents/claude/agent.mjs &                      # listens on 127.0.0.1:8765/decide
npx settlement-testbed --agent http://127.0.0.1:8765/decide --name claude-haiku
```

Environment: `SETTLEMENT_CLAUDE_MODEL` (default `claude-haiku-5-5`), `SETTLEMENT_CLAUDE_INPUT_USD_PER_MTOK` and `SETTLEMENT_CLAUDE_OUTPUT_USD_PER_MTOK` (defaults 0.10 and 0.50, the list prices when this was written; the report's `costUSD` is computed from them), `SETTLEMENT_CLAUDE_TIMEOUT_MS` (default 20000, below the testbed's 30 s), `PORT`.

`--dry-run` answers with fixed rules and no network, which is what the repository's CI uses.

What a full run costs: the default manifest is 4 scenarios × 10 seeds, with at most one decision per claim per tick and up to three ticks of checking, so expect a few hundred small requests. Each request sends the resident's observation (roughly 1–2 K tokens) and receives a short tool call; at Haiku list prices a full run is cents, not dollars. The report's `totals.selfReportedCostUSD` shows the actual figure.

Behaviour: one strict `decide` tool whose `action` enum is the request's `allowedActions`; `tool_choice: auto` with a prompt instruction (forced tool choice is not available on current models), `max_tokens` 300, effort `low`. A refusal, a `max_tokens` stop, a missing or extra tool call, an action not allowed or an unknown evidence id becomes an HTTP 400 reply, which the testbed records as an invalid answer. There are no retries, so a run means the same thing every time.

The `summary` field in reports is the model's own text. Review a report before publishing it.
