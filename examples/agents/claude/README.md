# Claude example agent

A Settlement test agent that asks Claude to decide each claim through one tool call. Zero dependencies, Node 22 or newer.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node examples/agents/claude/agent.mjs &                      # listens on 127.0.0.1:8765/decide
npx settlement-testbed --agent http://127.0.0.1:8765/decide --name claude-haiku --timeout 90000 --concurrency 2
```

Environment: `SETTLEMENT_CLAUDE_MODEL` (default `claude-haiku-5-5`), `SETTLEMENT_CLAUDE_INPUT_USD_PER_MTOK` and `SETTLEMENT_CLAUDE_OUTPUT_USD_PER_MTOK` (defaults 0.10 and 0.50, the Haiku 5.5 list prices for prompts up to 100K tokens when this was written; the report's `costUSD` is an estimate computed from these two numbers and the provider's token counts, not a billing figure), `SETTLEMENT_CLAUDE_TIMEOUT_MS` (default 60000 for the whole decision, including retries), `PORT`.

`--dry-run` answers with fixed rules and no network, which is what the repository's CI uses.

What a full run costs: the default manifest is 4 scenarios × 10 seeds, with at most one decision per claim per tick and up to three ticks of checking, so expect a few hundred small requests. Each request sends the resident's observation and receives a short tool call, so at Haiku list prices a full run should cost cents rather than dollars; this is an estimate, not a measurement. The report's `totals.selfReportedCostUSD` is the agent's own estimate from the configured prices; check your provider console for the billed amount.

Behaviour: one strict `decide` tool whose `action` enum is the request's `allowedActions`; `tool_choice: auto` with `disable_parallel_tool_use` and a prompt instruction (the Claude 5.5 generation rejects forced tool choice, and `auto` works on every model), `max_tokens` 300, effort `low`. A refusal, a `max_tokens` stop, a missing or extra tool call, an action not allowed or an unknown evidence id becomes an HTTP 400 reply, which the testbed records as an invalid answer. Transient provider responses use the bounded retry policy below; exhausted or non-retryable failures remain invalid answers. Each distinct provider failure (a rejected key, an unknown model, a timeout) is printed once to the agent's stderr so a run that scores 100% invalid is explained; only fixed HTTP-status diagnostics are logged; provider error text is discarded because it could echo the key or request.

The `summary` field in reports is the model's own text. Review a report before publishing it.


## Live runs

HTTP 429, 500, 502, 503 and 529 are retried up to three times within `SETTLEMENT_CLAUDE_TIMEOUT_MS` (default 60000 ms). The delay follows numeric `retry-after` seconds, capped at 10 seconds, or exponential backoff of 500, 1000 and 2000 ms. A retry never starts after the decision deadline. Other statuses, including 400/401/404, fail immediately; transport failures and timeouts are not retried.

Run the testbed with `--timeout 90000 --concurrency 2` so its per-decision timeout outlasts the agent’s complete retry budget. When overriding the agent timeout, keep the testbed timeout higher.

The report’s cost is an estimate from configured list prices and provider-reported token counts, not a bill. [Anthropic’s Haiku 5.5 pricing](https://platform.claude.com/docs/en/models/haiku-5-5/overview#pricing), checked on 2026-10-12, is $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100,000 tokens. Those defaults are unchanged. Above 100,000 input tokens, the rates are $0.50/$2.50; set both price overrides for that tier or a different model. Failed attempts do not return token usage and are not included in the report estimate. Confirm actual charges in the provider console.
