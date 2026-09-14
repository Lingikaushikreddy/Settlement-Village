import test from "node:test";
import assert from "node:assert/strict";
const C = await import("../lib/agent/claude.ts").catch(() => ({}));
const input = {
  observation: { tick: 1 },
  allowedActions: ["accept", "refuse", "inspect"],
  evidenceIds: ["e-1"],
};
const options = {
  enabled: true,
  apiKey: "test-key",
  model: "configured-test-model",
  remainingCalls: 1,
  maxOutputTokens: 128,
};
test("disabled Claude adapter never calls the provider", async () => {
  assert.equal(typeof C.proposeWithClaude, "function");
  let calls = 0;
  const r = await C.proposeWithClaude(
    input,
    { ...options, enabled: false },
    async () => {
      calls++;
      throw Error("not allowed");
    },
  );
  assert.equal(calls, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "disabled");
});
test("invalid action or unknown evidence is rejected", async () => {
  assert.equal(typeof C.proposeWithClaude, "function");
  for (const proposal of [
    { action: "steal", summary: "x", evidenceIds: [] },
    { action: "accept", summary: "x", evidenceIds: ["hidden"] },
  ]) {
    const r = await C.proposeWithClaude(
      input,
      options,
      async () =>
        new Response(
          JSON.stringify({
            content: [
              { type: "tool_use", name: "propose_action", input: proposal },
            ],
            usage: { input_tokens: 10, output_tokens: 10 },
          }),
          { status: 200 },
        ),
    );
    assert.equal(r.ok, false);
  }
});
test("valid structured choice reports usage without executing an action", async () => {
  assert.equal(typeof C.proposeWithClaude, "function");
  const r = await C.proposeWithClaude(
    input,
    options,
    async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "tool_use",
              name: "propose_action",
              input: {
                action: "inspect",
                summary: "Check the source.",
                evidenceIds: ["e-1"],
              },
            },
          ],
          usage: { input_tokens: 80, output_tokens: 20 },
        }),
        { status: 200 },
      ),
  );
  assert.equal(r.ok, true);
  assert.equal(r.proposal.action, "inspect");
  assert.deepEqual(r.usage, { inputTokens: 80, outputTokens: 20 });
});
test("exhausted call budget prevents dispatch", async () => {
  assert.equal(typeof C.proposeWithClaude, "function");
  const r = await C.proposeWithClaude(
    input,
    { ...options, remainingCalls: 0 },
    async () => {
      throw Error("unexpected");
    },
  );
  assert.equal(r.reason, "budget_exhausted");
});
