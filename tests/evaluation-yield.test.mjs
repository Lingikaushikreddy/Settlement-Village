import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSuite } from "../lib/sim/evaluation.ts";

// Hidden browser tabs throttle chained timers to one wake-up per second, or
// per minute after a while. The default yield must not depend on setTimeout.
test("the default yield keeps evaluating when timers are throttled", async () => {
  const realSetTimeout = globalThis.setTimeout;
  let watchdog;
  globalThis.setTimeout = () => 0; // a throttled timer that never fires in time
  try {
    const report = await Promise.race([
      evaluateSuite({
        scenarios: ["benign"],
        policies: ["baseline", "evidence"],
        seeds: [1, 2],
        maxTicks: 20,
      }),
      new Promise((_, reject) => {
        watchdog = realSetTimeout(
          () => reject(new Error("evaluation stalled waiting for timers")),
          5000,
        );
      }),
    ]);
    assert.equal(report.cases.length, 4);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    clearTimeout(watchdog);
  }
});
