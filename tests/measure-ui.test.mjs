import test from "node:test";
import assert from "node:assert/strict";
import { delta, formatTable, METRICS } from "../scripts/measure-ui.mjs";

test("delta subtracts each tracked metric and converts durations to milliseconds", () => {
  const before = { ScriptDuration: 1.0, TaskDuration: 2.0, LayoutCount: 10, RecalcStyleCount: 20, JSHeapUsedSize: 1_000_000, Timestamp: 5 };
  const after = { ScriptDuration: 1.5, TaskDuration: 2.25, LayoutCount: 14, RecalcStyleCount: 29, JSHeapUsedSize: 1_500_000, Timestamp: 15 };
  const d = delta(before, after);
  assert.deepEqual(d, { scriptMs: 500, taskMs: 250, layouts: 4, styleRecalcs: 9, heapMB: 0.5, seconds: 10 });
  assert.deepEqual(METRICS, ["ScriptDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "JSHeapUsedSize", "Timestamp"]);
});

test("formatTable renders one markdown row per scene with fixed decimals", () => {
  const text = formatTable([{ scene: "home", scriptMs: 512.345, taskMs: 700.1, layouts: 4, styleRecalcs: 9, heapMB: 0.5, seconds: 10 }]);
  assert.match(text, /\| Scene \| Script ms \| Task ms \| Layouts \| Style recalcs \| Heap Δ MB \| Seconds \|/);
  assert.match(text, /\| home \| 512\.3 \| 700\.1 \| 4 \| 9 \| 0\.50 \| 10 \|/);
});
