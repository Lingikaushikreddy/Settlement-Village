import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
  "components/game/campaign-shared.tsx": 60,
  "components/research/observatory.tsx": 250,
  "components/research/types.ts": 100,
  "components/research/use-playback.ts": 200,
  "components/research/use-local-worker.ts": 300,
  "components/research/use-model-context.ts": 100,
  "components/research/research-tabs.tsx": 120,
  "components/research/run-overview.tsx": 120,
  "components/research/playback-timeline.tsx": 250,
  "components/research/model-readiness.tsx": 150,
  "components/research/activity-panel.tsx": 250,
  "components/research/metrics-panel.tsx": 150,
  "components/research/run-library.tsx": 200,
  "components/research/new-experiment-dialog.tsx": 150,
  "components/research/event-dialog.tsx": 120,
  "components/research/field-guide-dialog.tsx": 150,
  "components/research/research-view-model.ts": 200,
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

// The region files may import shared leaf modules, never each other in a cycle: a cycle only works
// while every cross-reference is a hoisted declaration used lazily, and breaks the first time it is not.
export function importCycles(files, readSource) {
  const graph = new Map(
    files.map((file) => [
      file,
      [...readSource(file).matchAll(/from "\.\/([a-z-]+)(?:\.tsx?)?"/g)]
        .map((m) => `${file.slice(0, file.lastIndexOf("/"))}/${m[1]}`)
        .filter((dep) => files.some((f) => f.replace(/\.tsx?$/, "") === dep))
        .map((dep) => files.find((f) => f.replace(/\.tsx?$/, "") === dep)),
    ]),
  );
  const cycles = [];
  const done = new Set();
  const visit = (node, stack) => {
    if (stack.includes(node)) return cycles.push([...stack.slice(stack.indexOf(node)), node].join(" -> "));
    if (done.has(node)) return;
    for (const dep of graph.get(node) ?? []) visit(dep, [...stack, node]);
    done.add(node);
  };
  for (const file of files) visit(file, []);
  return cycles;
}

test("the campaign region files have no import cycle", () => {
  const files = Object.keys(limits).filter((f) => f.startsWith("components/game/"));
  assert.deepEqual(importCycles(files, (f) => readFileSync(f, "utf8")), []);
});

test("the cycle checker reports a two-file cycle", () => {
  const src = { "components/game/a.tsx": 'import { b } from "./b";', "components/game/b.tsx": 'import { a } from "./a";' };
  assert.deepEqual(importCycles(Object.keys(src), (f) => src[f]), ["components/game/a.tsx -> components/game/b.tsx -> components/game/a.tsx"]);
});

test("the research region files have no import cycle", () => {
  const files = Object.keys(limits).filter((f) => f.startsWith("components/research/"));
  assert.deepEqual(importCycles(files, (f) => readFileSync(f, "utf8")), []);
});

test("the research desk is imported from components/research, not the old components/observatory path", () => {
  const sources = ["components/game/research-overlay.tsx", "components/game/campaign-view-model.ts"];
  const stale = sources.filter((f) => /from "\.\.\/observatory"|import\("\.\.\/observatory"\)/.test(readFileSync(f, "utf8")));
  assert.deepEqual(stale, []);
  assert.equal(existsSync("components/observatory.tsx"), false, "the re-export shim is removed");
});
