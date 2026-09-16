import test from "node:test";
import assert from "node:assert/strict";
import { RunStore } from "../worker/store.ts";
import { modelStep } from "../worker/model.ts";
import { verifyReplay } from "../lib/sim/engine.ts";
function atClaim(store) {
  let s = store.create({ seed: 42, maxTicks: 32 });
  for (let i = 0; i < 8; i++)
    s = store.command(s.run.id, {
      id: `s${i}`,
      action: "step",
      expectedVersion: s.version,
    });
  return s;
}
const config = {
  enabled: true,
  apiKey: "test-only",
  model: "fixture-model",
  inputPrice: 2,
  outputPrice: 10,
  dailyBudget: 1,
};
const reply = async () =>
  new Response(
    JSON.stringify({
      content: [
        {
          type: "tool_use",
          name: "propose_action",
          input: {
            action: "reject_claim",
            summary: "Reject this unsupported claim.",
            evidenceIds: [],
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    }),
    { status: 200 },
  );
test("disabled model mode never contacts a provider or reserves a request", async () => {
  const store = new RunStore(":memory:");
  try {
    const s = atClaim(store);
    let calls = 0;
    await assert.rejects(
      modelStep(
        store,
        s.run.id,
        { id: "m1", expectedVersion: s.version },
        { ...config, enabled: false },
        async () => {
          calls++;
          return reply();
        },
      ),
      /disabled/i,
    );
    assert.equal(calls, 0);
    assert.equal(store.modelUsage().requests, 0);
  } finally {
    store.close();
  }
});
test("model responses commit once, preserve replay, and duplicate request IDs never charge twice", async () => {
  const store = new RunStore(":memory:");
  try {
    const s = atClaim(store);
    let calls = 0;
    const transport = async () => {
      calls++;
      return reply();
    };
    const cmd = { id: "m1", expectedVersion: s.version };
    const result = await modelStep(store, s.run.id, cmd, config, transport);
    assert.equal(result.run.incidents[0].decision, "refused");
    assert.equal(verifyReplay(result.run).ok, true);
    assert.equal(result.version, s.version + 1);
    const twice = await modelStep(store, s.run.id, cmd, config, transport);
    assert.deepEqual(twice, result);
    assert.equal(calls, 1);
    assert.equal(store.modelUsage().requests, 1);
  } finally {
    store.close();
  }
});
test("in-flight model requests block concurrent world commands and reserve spend before dispatch", async () => {
  const store = new RunStore(":memory:");
  try {
    const s = atClaim(store);
    let finish;
    const response = new Promise((r) => (finish = r));
    const pending = modelStep(
      store,
      s.run.id,
      { id: "m1", expectedVersion: s.version },
      config,
      () => response,
    );
    assert.ok(store.modelUsage().reservedUSD > 0);
    assert.throws(
      () =>
        store.command(s.run.id, {
          id: "race",
          action: "step",
          expectedVersion: s.version,
        }),
      /model request/i,
    );
    await assert.rejects(
      modelStep(
        store,
        s.run.id,
        { id: "m2", expectedVersion: s.version },
        config,
        reply,
      ),
      /model request/i,
    );
    finish(await reply());
    await pending;
  } finally {
    store.close();
  }
});
test("provider failure retains the reservation and cannot retry the same paid request silently", async () => {
  const store = new RunStore(":memory:");
  try {
    const s = atClaim(store);
    const cmd = { id: "m1", expectedVersion: s.version };
    let calls = 0;
    const fail = async () => {
      calls++;
      throw Error("offline");
    };
    await assert.rejects(
      modelStep(store, s.run.id, cmd, config, fail),
      /provider/i,
    );
    assert.equal(store.get(s.run.id).version, s.version);
    assert.ok(store.modelUsage().reservedUSD > 0);
    await assert.rejects(
      modelStep(store, s.run.id, cmd, config, fail),
      /provider|failed/i,
    );
    assert.equal(calls, 1);
  } finally {
    store.close();
  }
});
test("daily budget rejects before dispatch and does not modify the world", async () => {
  const store = new RunStore(":memory:");
  try {
    const s = atClaim(store);
    let calls = 0;
    await assert.rejects(
      modelStep(
        store,
        s.run.id,
        { id: "m1", expectedVersion: s.version },
        { ...config, dailyBudget: 0.00001 },
        async () => {
          calls++;
          return reply();
        },
      ),
      /budget/i,
    );
    assert.equal(calls, 0);
    assert.equal(store.get(s.run.id).version, s.version);
  } finally {
    store.close();
  }
});
test("interrupted requests retain their budget and cannot silently retry after restart", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "settlement-model-"));
  let store = new RunStore(join(dir, "test.sqlite"));
  try {
    const s = atClaim(store),
      cmd = { id: "interrupted", expectedVersion: s.version };
    store.reserveModel(s.run.id, cmd, 0.02, 1);
    store.close();
    store = new RunStore(join(dir, "test.sqlite"));
    let calls = 0;
    await assert.rejects(
      modelStep(store, s.run.id, cmd, config, async () => {
        calls++;
        return reply();
      }),
      /Interrupted/,
    );
    assert.equal(calls, 0);
    assert.equal(store.modelUsage().reservedUSD, 0.02);
    assert.equal(store.get(s.run.id).version, s.version);
    const stepped = store.command(s.run.id, {
      id: "free-step",
      action: "step",
      expectedVersion: s.version,
    });
    assert.equal(stepped.run.modelCalls, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
