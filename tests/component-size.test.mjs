import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Spec: docs/superpowers/specs/2026-10-10-ui-architecture-design.md, "Target layout". Lines as wc -l counts them.
export const limits = {
  "components/game/game.tsx": 330,
  "components/game/session-gate.tsx": 200,
  "components/game/use-campaign.ts": 250,
  "components/game/campaign-hud.tsx": 200,
  "components/game/selection-panel.tsx": 250,
  "components/game/campaign-footer.tsx": 150,
  "components/game/campaign-dialogs.tsx": 300,
  "components/game/guide.tsx": 200,
  "components/game/battle-overlay.tsx": 250,
  "components/game/research-overlay.tsx": 150,
  "components/game/campaign-view-model.ts": 150,
};

export function oversize(limitMap, lines) {
  return Object.entries(limitMap)
    .map(([file, limit]) => [file, lines(file), limit])
    .filter(([, n, limit]) => n > limit)
    .map(([file, n, limit]) => `${file}: ${n} lines (limit ${limit})`);
}

const countLines = (file) => readFileSync(file, "utf8").split("\n").length - 1;

test("every file the UI architecture spec lists stays under its size limit", () => {
  assert.deepEqual(oversize(limits, countLines), []);
});

test("the size checker reports an oversize file", () => {
  const fake = { "a.tsx": 10, "b.tsx": 10 };
  assert.deepEqual(oversize(fake, (f) => (f === "a.tsx" ? 11 : 10)), ["a.tsx: 11 lines (limit 10)"]);
});
