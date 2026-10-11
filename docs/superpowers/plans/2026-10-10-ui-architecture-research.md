# UI Architecture, Plan 2: Research Screen Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `components/observatory.tsx` (1,429 lines) into `components/research/`: a thin composer, a playback hook, a local-worker hook, one file per visible region and a tested view-model module, with no change to behaviour, CSS or the three screenshot baselines; then release 0.10.0.

**Architecture:** `usePlayback` is the only writer of `run`, `tick`, `playing`, `mode` and `queued`. `useLocalWorker` owns every request to the local worker on port 8787 and hands runs to the playback hook through a `receive` callback instead of setting state of its own. The composer branches between the two for worker mode (step, toggle, intervene, jump), holds the view, the open dialogs and the notice, and lays out regions that receive plain props. Pure logic lives in `research-view-model.ts` under `node --test`. Behaviour, including the worker paths, is pinned by Playwright before each extraction; the worker is stubbed with `page.route`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Playwright 1.64 (Chromium), `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-10-ui-architecture-design.md` (Plan 1, the campaign split, is merged; its conventions apply here: hooks live in the file that owns the concern, a region gets an object prop when it needs a hook's whole surface, shared helpers live in leaf modules, and `tests/component-size.test.mjs` checks sizes and import cycles).

## Global Constraints

- Engine behaviour, the agent protocol, the report format and the scenario schema do not change; `npm run evaluate -- --verify docs/evaluation-results.json` and `npm run eval:agent -- --verify public/examples/agent-report.json` pass at the end of every task.
- The URL parameters `seed`, `scenario`, `policy`, `view`, `report`, the saved-run storage key `settlement-library-v1` and its format, and the worker's HTTP API do not change.
- No CSS file changes or moves. `git diff --stat -M main -- '*.css'` is empty in every PR. The observatory imports no stylesheet today; none is added.
- The three screenshot baselines in `tests/e2e/visual.spec.ts-snapshots/` are never re-captured. `npm run test:e2e` passes in every task. Before building, run `pkill -f next-server`: a leftover server on port 5173 serves an old build and makes the whole browser suite fail.
- No new dependencies.
- Not edited: `lib/`, `worker/`, `components/experiments.tsx`, `components/resident-inspector.tsx`, `components/agent-report.tsx`, `components/ui/*`, `components/game/*` (except Task 9's one-line import path changes in `research-overlay.tsx` and `campaign-view-model.ts`).
- File size limits (lines, `wc -l`): `components/research/observatory.tsx` 250, `types.ts` 100, `use-playback.ts` 200, `use-local-worker.ts` 250, `research-tabs.tsx` 120, `playback-timeline.tsx` 250, `model-readiness.tsx` 150, `activity-panel.tsx` 250, `metrics-panel.tsx` 150, `run-library.tsx` 200, `new-experiment-dialog.tsx` 150, `event-dialog.tsx` 120, `field-guide-dialog.tsx` 150, `research-view-model.ts` 200, plus two files this plan adds to the spec in Task 9: `run-overview.tsx` 120 (scenario strip, resident buttons and inspector) and `use-model-context.ts` 100 (the in-page model-context tools).
- If the composer is over 250 lines after Prettier once every region is out, raise its limit to the measured length rounded up to the next 10, with a ledgered ruling and the spec row updated in the same PR, as Plan 1 did for the campaign.
- `React.memo` only with a recorded drop in `docs/ui-architecture-verification.md`.
- New and moved files are Prettier-formatted (`npx --yes prettier@3.6.2 --write <files>`); `npx --yes prettier@3.6.2 --check components/research` is clean at the end of every task.
- Each task is one pull request against the protected `main`: branch `ui/<task-slug>`, `gh pr create -R Lingikaushikreddy/Settlement-Village`, wait for CI, `gh pr merge --squash --delete-branch`, then `git checkout main && git pull`. Commits and PRs carry no assistant attribution. Every PR body ends with `CSS diff: none` after the executor ran `git diff --stat -M main -- '*.css'` and saw no output.
- Run `npm run lint` and `npm run typecheck` before every commit.

### Deliberate departures from the spec's research table

- The spec's `run-library.tsx` row says "open and delete". The library has no delete today; it has open and export. The file owns open and export, and `useSavedRuns`.
- `research-tabs.tsx` also renders the field-guide button and the "village resources stay unchanged" strip, which sit between the tabs and the first region in the DOM.
- Two files are added: `run-overview.tsx` (the scenario strip with "Find an incident", the resident buttons and the `ResidentInspector`) and `use-model-context.ts` (the `settlement_inspect_run` and `settlement_seek_tick` tools the observatory registers with an in-page `document.modelContext`).
- The new-experiment dialog validates the seed through `parseSeed` in the view model.

## Review Focus

1. A worker stream message that arrives after the player has opened a different run must not replace the run on screen. Test in Task 1 (`ignores a stream message for a run the player has left`), re-run from Task 5 on.
2. A command reply whose version is older than the last stream message must not roll the run back. Test in Task 1 (`an older command reply does not roll the run back`).
3. A tampered saved run is dropped silently while valid ones load, and unreadable storage shows a notice instead of an empty archive with no explanation. Unit test in Task 3 (`parseSavedLibrary keeps verified runs and drops tampered ones`), e2e in Task 1 (`reports unreadable saved runs`).
4. Seed input edge cases: an empty field means seed 0 (accepted, as today), while negative, fractional and out-of-range seeds are rejected with a notice and the dialog stays open. Unit test in Task 3 (`parseSeed accepts 0 to 999999 whole numbers`), e2e in Task 1 (`rejects a seed outside the range`).
5. The in-page model-context tools still register, inspect and seek after their effect moves out of the component. Test in Task 1 (`registers the model-context tools and seeks with them`).

---

## File structure after this plan

```
components/research/
  observatory.tsx            composer: view, dialogs, notice, worker-mode branching, layout
  types.ts                   ResearchFrame, ResearchMode, WorkerRun
  use-playback.ts            run, tick, playing, speed, mode, queued; interval; URL seed start
  use-local-worker.ts        every request to 127.0.0.1:8787; EventSource; session and revision guards
  use-model-context.ts       settlement_inspect_run and settlement_seek_tick tools
  research-view-model.ts     pure functions for the regions
  research-tabs.tsx          heading, tools nav, new-experiment and field-guide buttons, boundary strip
  run-overview.tsx           scenario strip, resident buttons, ResidentInspector
  playback-timeline.tsx      transport, track, speed, save; run toolbar with intervene, export, verify
  model-readiness.tsx        live model panel and recorded model decisions
  activity-panel.tsx         incident log, event feed, public board
  metrics-panel.tsx          resistance, harm, coin balances
  run-library.tsx            archive view and useSavedRuns
  new-experiment-dialog.tsx  scenario, policy, seed, create locally or on the worker
  event-dialog.tsx           recorded evidence detail
  field-guide-dialog.tsx     the research field guide
tests/e2e/observatory.spec.ts
tests/e2e/observatory-worker.spec.ts
tests/e2e/fixtures/worker-run-0.json, worker-run-1.json, worker-run-2.json
tests/research-view-model.test.mjs
```

`components/observatory.tsx` becomes a two-line re-export in Task 2 and is deleted in Task 9.

---

### Task 1: Behavioural tests that pin the research screen before any extraction

**Files:**
- Create: `tests/e2e/observatory.spec.ts`
- Create: `tests/e2e/observatory-worker.spec.ts`
- Create: `tests/e2e/fixtures/worker-run-0.json`, `worker-run-1.json`, `worker-run-2.json`

**Interfaces:**
- Consumes: current markup only.
- Produces: the regression suite every later task runs.

- [ ] **Step 1: Generate the worker fixtures from the real engine**

```bash
node --experimental-strip-types -e '
import("./lib/sim/engine.ts").then((e) => {
  const fs = require("node:fs");
  let run = { ...e.createRun({ seed: 42, scenario: "scarcity", policy: "baseline", maxTicks: 60 }), id: "worker-w1", name: "Worker grain run" };
  for (let n = 0; n < 3; n++) {
    fs.writeFileSync(`tests/e2e/fixtures/worker-run-${n}.json`, JSON.stringify(run) + "\n");
    run = e.advance(run);
  }
  console.log("fixtures written");
});'
```

Expected: `fixtures written`; three files with 1, 2 and 3 snapshots.

- [ ] **Step 2: Write the recorded and browser-run tests**

```ts
// tests/e2e/observatory.spec.ts
import { expect, test } from "@playwright/test";

const SEEDED = "/?view=research&seed=42&scenario=scarcity&policy=baseline";
const tickLabel = (page: import("@playwright/test").Page) => page.locator(".tick-label strong");
const notice = (page: import("@playwright/test").Page, text: string | RegExp) =>
  page.locator(".notice").filter({ hasText: text });
// The research desk first shows the one-snapshot council run (also "The Missing Grain", 32 ticks);
// the ?seed= run replaces it a moment later. Wait for the seeded run's 60-tick label.
async function openSeeded(page: import("@playwright/test").Page) {
  await openSeeded(page);
  await expect(page.locator(".tick-label span")).toContainText("60 ticks");
}

test("plays, pauses, steps and rewinds a seeded recorded run", async ({ page }) => {
  await openSeeded(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".tick-label span")).toContainText("Playing");
  await expect(tickLabel(page)).toHaveText(/Tick 0[2-9]/, { timeout: 5000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".tick-label span")).toContainText("Paused");
  await page.getByRole("button", { name: "Rewind to beginning" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("finds the first incident and opens its evidence", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: /Find an incident/ }).click();
  await expect(tickLabel(page)).toHaveText("Tick 08");
  await expect(page.locator(".incident-card").first()).toBeVisible();
  await page.locator(".incident-card").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Recorded evidence · tick \d+/)).toBeVisible();
  await dialog.getByRole("button", { name: /Go to this tick/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lists recorded events in the feed and on the public board", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: /Find an incident/ }).click();
  await page.getByRole("tab", { name: "Event feed" }).click();
  await expect(page.locator(".event-item").first()).toBeVisible();
  await page.getByRole("tab", { name: "Public board" }).click();
  await expect(page.locator(".board-note").first()).toBeVisible();
});

test("shows the village metrics and switches to Compare", async ({ page }) => {
  await openSeeded(page);
  const metrics = page.locator(".metrics-panel");
  await expect(metrics.getByText("Behavioral resistance")).toBeVisible();
  await expect(metrics.locator(".wealth-chart > div").first()).toBeVisible();
  await metrics.getByRole("button", { name: /Compare decision policies/ }).click();
  await expect(page.getByRole("heading", { name: "Test a different decision." })).toBeVisible();
});

test("creates a browser simulation and queues an intervention", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByLabel("World seed").fill("7");
  await dialog.getByRole("button", { name: "Create simulation" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".research-boundary")).toContainText("Browser experiment");
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await page.getByRole("combobox", { name: "Intervene in simulation" }).click();
  await page.getByRole("option", { name: "Add 12 grain" }).click();
  await expect(notice(page, "Intervention queued for the next new tick.")).toBeVisible();
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
});

test("rejects a seed outside the range", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByLabel("World seed").fill("1000000");
  await dialog.getByRole("button", { name: "Create simulation" }).click();
  await expect(notice(page, "Choose a whole-number seed from 0 to 999999.")).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("saves a run and keeps it in the archive across a reload", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: "Save run" }).click();
  await expect(notice(page, "Run saved to this browser.")).toBeVisible();
  await page.goto("/?view=archive");
  const row = page.locator(".library-row").filter({ hasText: "Seed 42" });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open replay" }).click();
  await expect(page.locator(".research-boundary")).toContainText("Recorded evidence");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("reports unreadable saved runs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("settlement-library-v1", "{not json"));
  await page.goto("/?view=research");
  await expect(notice(page, "Saved runs could not be read.")).toBeVisible();
});

test("registers the model-context tools and seeks with them", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: { name: string; execute: (input?: unknown) => unknown }[] = [];
    (window as unknown as { __tools: typeof tools }).__tools = tools;
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool: (tool: (typeof tools)[number]) => {
        tools.push(tool);
      },
    };
  });
  await openSeeded(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  const names = await page.evaluate(() => (window as unknown as { __tools: { name: string }[] }).__tools.map((t) => t.name));
  expect(names).toEqual(["settlement_inspect_run", "settlement_seek_tick"]);
  await page.evaluate(() => (window as unknown as { __tools: { execute: (i: unknown) => unknown }[] }).__tools[1].execute({ tick: 5 }));
  await expect(tickLabel(page)).toHaveText("Tick 05");
  const inspected = await page.evaluate(() => (window as unknown as { __tools: { execute: () => { tick: number; mode: string } }[] }).__tools[0].execute());
  expect(inspected).toMatchObject({ tick: 5, mode: "recorded" });
});
```

- [ ] **Step 3: Write the local-worker tests with a stubbed worker**

```ts
// tests/e2e/observatory-worker.spec.ts
import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const W = "http://127.0.0.1:8787";
const fixture = (n: number) => JSON.parse(readFileSync(`tests/e2e/fixtures/worker-run-${n}.json`, "utf8"));
const tickLabel = (page: Page) => page.locator(".tick-label strong");
const boundary = (page: Page) => page.locator(".research-boundary");
const quietStream = (route: Route) =>
  route.fulfill({ status: 200, contentType: "text/event-stream", body: "retry: 600000\n\n" });

async function stubWorker(page: Page, stream: (route: Route) => Promise<void> = quietStream) {
  const commands: { action: string; expectedVersion: number }[] = [];
  await page.route(`${W}/health`, (r) => r.fulfill({ json: { ok: true } }));
  await page.route(`${W}/model/status`, (r) =>
    r.fulfill({ json: { ready: false, reason: "Stub worker: no model configured.", model: null, dailyBudgetUSD: null } }),
  );
  await page.route(`${W}/runs`, (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: { runs: [{ id: "worker-w1", name: "Worker grain run", tick: 0, running: false }] } })
      : r.fulfill({ json: { run: fixture(0), version: 1 } }),
  );
  await page.route(`${W}/runs/worker-w1`, (r) => r.fulfill({ json: { run: fixture(0), version: 1, running: false } }));
  await page.route(`${W}/runs/worker-w1/stream`, stream);
  await page.route(`${W}/runs/worker-w1/commands`, async (r) => {
    commands.push(r.request().postDataJSON());
    await r.fulfill({ json: { run: fixture(1), version: 2, running: false } });
  });
  return commands;
}

async function connect(page: Page) {
  await page.goto("/?view=archive");
  await expect(page.getByText("On your local worker")).toBeVisible();
  await page.getByRole("button", { name: "Connect to run" }).click();
  await expect(boundary(page)).toContainText("Local worker experiment");
}

test("lists worker runs in the archive and connects to one", async ({ page }) => {
  await stubWorker(page);
  await connect(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await expect(page.getByRole("button", { name: "Rewind to beginning" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Playback speed" })).toBeDisabled();
});

test("steps a worker run through the command endpoint", async ({ page }) => {
  const commands = await stubWorker(page);
  await connect(page);
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
  expect(commands[0]).toMatchObject({ action: "step", expectedVersion: 1 });
});

test("shows the worker's model status", async ({ page }) => {
  await stubWorker(page);
  await page.goto("/?view=research");
  await expect(page.getByText("Stub worker: no model configured.")).toBeVisible();
});

test("creates a run on the local worker", async ({ page }) => {
  await stubWorker(page);
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByRole("button", { name: "Create on local worker" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(boundary(page)).toContainText("Local worker experiment");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("ignores a stream message for a run the player has left", async ({ page }) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await stubWorker(page, async (route) => {
    await released;
    const message = JSON.stringify({ run: fixture(2), version: 9, running: false });
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: `retry: 600000\ndata: ${message}\n\n` }).catch(() => {});
  });
  await connect(page);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.locator(".library-feature").filter({ hasText: "Included reference run" }).getByRole("button", { name: /Open replay/ }).click();
  await expect(boundary(page)).toContainText("Recorded evidence");
  release();
  await page.waitForTimeout(500);
  await expect(boundary(page)).toContainText("Recorded evidence");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("an older command reply does not roll the run back", async ({ page }) => {
  await stubWorker(page, (route) => {
    const message = JSON.stringify({ run: fixture(2), version: 3, running: false });
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: `retry: 600000\ndata: ${message}\n\n` });
  });
  await connect(page);
  await expect(tickLabel(page)).toHaveText("Tick 02");
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await page.waitForTimeout(500);
  await expect(tickLabel(page)).toHaveText("Tick 02");
});
```

- [ ] **Step 4: Run them against the unchanged code**

Run: `pkill -f next-server; npm run build && npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts`
Expected: 15 passed. These are characterization tests: they must pass on the code as it is today. If one fails, read the failing locator against `components/observatory.tsx` and fix the test, not the component. The page is served from `127.0.0.1:5173`, which the observatory treats as a local checkout, so it calls the stubbed worker.

- [ ] **Step 5: Full suite, commit, PR**

Run: `npx playwright test && npm test 2>&1 | tail -3`
Expected: 36 browser tests pass (21 existing + 15); `ℹ fail 0`.

```bash
git checkout -b ui/research-characterization
git add tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts tests/e2e/fixtures/worker-run-*.json
git commit -m "test: pin research screen behaviour before the component split"
git push -u origin ui/research-characterization
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Fifteen Playwright tests that pin the research screen before it is split: playback, incidents and evidence, feed and board, metrics, browser simulations and interventions, seed validation, the archive across reloads, unreadable storage, the in-page model-context tools, and six local-worker paths with the worker stubbed through page.route (list, connect, step, model status, create, stale stream and stale command guards). No product code.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 2: Move the observatory into `components/research/` with a shim

**Files:**
- Move: `components/observatory.tsx` → `components/research/observatory.tsx` (`git mv`)
- Create: `components/research/types.ts`
- Create: `components/observatory.tsx` (shim)

**Interfaces:**
- Produces:

```ts
// components/research/types.ts
export type ResearchMode = "recorded" | "local" | "worker";
export type ResearchFrame = { run: Run; tick: number; selected: string; mode: ResearchMode };
/** A run as the local worker reports it. */
export type WorkerRun = { run: Run; running: boolean; queued?: Intervention };
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts tests/e2e/visual.spec.ts tests/e2e/research.spec.ts tests/e2e/gallery.spec.ts`
Expected: all pass.

- [ ] **Step 2: Move and add the types**

```bash
mkdir -p components/research
git mv components/observatory.tsx components/research/observatory.tsx
```

```ts
// components/research/types.ts
import type { Intervention, Run } from "@/lib/sim/types";

export type ResearchMode = "recorded" | "local" | "worker";

/** What the research desk reports to the campaign map each time the run, tick, resident or mode changes. */
export type ResearchFrame = {
  run: Run;
  tick: number;
  selected: string;
  mode: ResearchMode;
};

/** A run as the local worker reports it: on attach, on each stream message and in each command reply. */
export type WorkerRun = { run: Run; running: boolean; queued?: Intervention };
```

In `components/research/observatory.tsx`: change `import { ResidentInspector } from "./resident-inspector";` to `"../resident-inspector"`, `import { Experiments, exportJson } from "./experiments";` to `"../experiments"`, delete the local `export type ResearchFrame = {…};` block and add `import type { ResearchFrame, ResearchMode } from "./types";` plus `export type { ResearchFrame } from "./types";`. Replace the two literal `"recorded" | "local" | "worker"` annotations with `ResearchMode`.

```ts
// components/observatory.tsx — removed in Task 9 once the campaign imports the new path
export { Observatory } from "./research/observatory";
export type { ResearchFrame } from "./research/types";
```

- [ ] **Step 3: Verify and ship**

Run: `npm run lint && npm run typecheck && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: clean; 36 browser tests pass; `ℹ fail 0`; no CSS output. `git diff -M --stat main` shows the move as a rename with a small change count.

```bash
git checkout -b ui/research-move
git add components/observatory.tsx components/research
git commit -m "refactor(research): move the observatory into components/research with a re-export shim"
git push -u origin ui/research-move
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Moves components/observatory.tsx to components/research/observatory.tsx (git rename) and its ResearchFrame type to components/research/types.ts. The old path re-exports both so the campaign's lazy import keeps working; Task 9 of the plan removes the shim.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 3: Research view model

**Files:**
- Create: `components/research/research-view-model.ts`
- Create: `tests/research-view-model.test.mjs`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: `Run`, `Event` as `RunEvent`, `Incident`, `World` (`lib/sim/types.ts`), `supportedEngine`, `verifyReplay` (`lib/sim/engine.ts`), `ResearchMode` (Task 2).
- Produces (pure, no React; relative `.ts` imports so `node --test` can load it, like `components/game/campaign-view-model.ts`):

```ts
export function validateSaved(x: unknown): x is Run;
export function parseSavedLibrary(raw: string | null): { runs: Run[]; error: boolean };
export function addToLibrary(library: Run[], run: Run): Run[];
export function parseSeed(text: string): number | null;
export function researchHeading(view: string): string;
export function modeLabel(mode: ResearchMode): string;
export function snapshotAt(run: Run, tick: number): World;
export function nameIn(agents: { id: string; name: string }[], id: string): string;
export function incidentEvents(run: Run): RunEvent[];
export function nextIncidentEvent(run: Run, tick: number): RunEvent | undefined;
export function visibleIncidents(run: Run, tick: number): Incident[];
export function incidentOutcome(incident: Incident, tick: number): Incident["outcome"] | "pending";
export function playbackStatus(run: Run, tick: number, playing: boolean): "Playing" | "Completed" | "Paused";
export function feedEvents(run: Run, tick: number): RunEvent[];
export function boardEvents(run: Run, tick: number): RunEvent[];
export function wealthBars(world: World): { name: string; coins: number; color: string; width: number }[];
export function canAskModel(input: { ready: boolean; mode: ResearchMode; playing: boolean; queued: boolean; busy: boolean; run: Run; tick: number }): boolean;
```

- [ ] **Step 1: Write the failing tests**

```js
// tests/research-view-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { runToEnd } from "../lib/sim/engine.ts";
import {
  addToLibrary, boardEvents, canAskModel, feedEvents, incidentEvents, incidentOutcome, modeLabel,
  nextIncidentEvent, parseSavedLibrary, parseSeed, playbackStatus, researchHeading, snapshotAt,
  visibleIncidents, wealthBars,
} from "../components/research/research-view-model.ts";

const run = runToEnd({ seed: 42, scenario: "scarcity", policy: "baseline", maxTicks: 60 });

test("incident helpers follow the seeded run: first claim at tick 8, four incidents", () => {
  assert.equal(incidentEvents(run)[0].tick, 8);
  assert.equal(nextIncidentEvent(run, 0).tick, 8);
  assert.equal(nextIncidentEvent(run, 60).tick, 8, "wraps to the first claim after the last");
  assert.equal(visibleIncidents(run, 7).length, 0);
  assert.equal(visibleIncidents(run, 60).length, 4);
  const first = run.incidents[0];
  assert.equal(incidentOutcome(first, first.tick), "pending");
  assert.equal(incidentOutcome(first, 60), first.outcome);
});

test("playbackStatus, feedEvents and boardEvents read the tick", () => {
  assert.equal(playbackStatus(run, 60, false), "Completed");
  assert.equal(playbackStatus(run, 3, false), "Paused");
  assert.equal(playbackStatus(run, 3, true), "Playing");
  const feed = feedEvents(run, 60);
  assert.ok(feed.length <= 20 && feed.length > 0);
  assert.ok(feed.every((e, i) => i === 0 || e.tick <= feed[i - 1].tick), "newest first");
  assert.ok(boardEvents(run, 60).every((e) => e.type === "claim" || e.type === "intervention"));
  assert.equal(boardEvents(run, 7).length, 0);
});

test("parseSavedLibrary keeps verified runs and drops tampered ones", () => {
  const tampered = structuredClone(run);
  tampered.snapshots[5].agents[1].inventory.coins += 1;
  assert.deepEqual(parseSavedLibrary(JSON.stringify([run, tampered])).runs.map((r) => r.id), [run.id]);
  assert.deepEqual(parseSavedLibrary(null), { runs: [], error: false });
  assert.deepEqual(parseSavedLibrary('{"not":"a list"}'), { runs: [], error: false });
  assert.equal(parseSavedLibrary("{not json").error, true);
});

test("addToLibrary puts the run first, drops its older copy and keeps six", () => {
  const runs = Array.from({ length: 7 }, (_, i) => ({ ...run, id: `r${i}` }));
  const next = addToLibrary(runs, { ...run, id: "r3" });
  assert.equal(next[0].id, "r3");
  assert.equal(next.length, 6);
  assert.equal(next.filter((r) => r.id === "r3").length, 1);
});

test("parseSeed accepts 0 to 999999 whole numbers", () => {
  assert.equal(parseSeed("42"), 42);
  assert.equal(parseSeed(""), 0, "an empty field is seed 0, as before the split");
  for (const bad of ["-1", "1000000", "4.5", "abc"]) assert.equal(parseSeed(bad), null, bad);
});

test("labels, snapshot, wealth and model gate", () => {
  assert.equal(researchHeading("experiments"), "Test a different decision.");
  assert.equal(researchHeading("library"), "Your village archive.");
  assert.equal(researchHeading("observatory"), "Follow the evidence.");
  assert.equal(modeLabel("recorded"), "Recorded evidence");
  assert.equal(modeLabel("worker"), "Local worker experiment");
  assert.equal(modeLabel("local"), "Browser experiment");
  assert.equal(snapshotAt(run, 999), run.snapshots.at(-1));
  const bars = wealthBars(snapshotAt(run, 0));
  assert.ok(bars.length > 0 && bars.every((b) => b.width >= 0 && b.width <= 100));
  const gate = { ready: true, mode: "worker", playing: false, queued: false, busy: false, run, tick: 8 };
  assert.equal(canAskModel({ ...gate, ready: false }), false);
  assert.equal(canAskModel({ ...gate, mode: "local" }), false);
  assert.equal(canAskModel({ ...gate, tick: 60 }), false, "no pending decision at the end of the run");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --experimental-strip-types --test tests/research-view-model.test.mjs`
Expected: FAIL, `Cannot find module` for `research-view-model.ts`.

- [ ] **Step 3: Write the module**

```ts
// components/research/research-view-model.ts
// Pure functions behind the research regions. No React, no DOM: tested under node --test,
// which is why the imports are relative with extensions rather than the "@/" alias.
import { supportedEngine, verifyReplay } from "../../lib/sim/engine.ts";
import type { Event as RunEvent, Incident, Run, World } from "../../lib/sim/types.ts";
import type { ResearchMode } from "./types.ts";

export function validateSaved(x: unknown): x is Run {
  return (
    !!x &&
    typeof x === "object" &&
    (x as Run).schemaVersion === 1 &&
    supportedEngine((x as Run).engineVersion) &&
    Array.isArray((x as Run).snapshots) &&
    (x as Run).snapshots.length <= 151 &&
    Array.isArray((x as Run).events) &&
    Array.isArray((x as Run).incidents) &&
    !!(x as Run).config
  );
}

/** Saved runs from browser storage: only runs that validate and replay exactly, at most eight. */
export function parseSavedLibrary(raw: string | null): { runs: Run[]; error: boolean } {
  try {
    const saved = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return { runs: [], error: false };
    const runs = saved
      .filter((x) => {
        try {
          return validateSaved(x) && verifyReplay(x).ok;
        } catch {
          return false;
        }
      })
      .slice(0, 8);
    return { runs, error: false };
  } catch {
    return { runs: [], error: true };
  }
}

export function addToLibrary(library: Run[], run: Run): Run[] {
  return [run, ...library.filter((r) => r.id !== run.id)].slice(0, 6);
}

export function parseSeed(text: string): number | null {
  const seed = Number(text);
  return Number.isInteger(seed) && seed >= 0 && seed <= 999999 ? seed : null;
}

export function researchHeading(view: string): string {
  return view === "experiments" ? "Test a different decision." : view === "library" ? "Your village archive." : "Follow the evidence.";
}

export function modeLabel(mode: ResearchMode): string {
  return mode === "recorded" ? "Recorded evidence" : mode === "worker" ? "Local worker experiment" : "Browser experiment";
}

export function snapshotAt(run: Run, tick: number): World {
  return run.snapshots[tick] || run.snapshots[run.snapshots.length - 1];
}

// Residents are shown by name; "village" and "observer" fall back to their label.
export function nameIn(agents: { id: string; name: string }[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

export function incidentEvents(run: Run): RunEvent[] {
  return run.events.filter((e) => e.type === "claim");
}

export function nextIncidentEvent(run: Run, tick: number): RunEvent | undefined {
  const claims = incidentEvents(run);
  return claims.find((e) => e.tick > tick) || claims[0];
}

export function visibleIncidents(run: Run, tick: number): Incident[] {
  return run.incidents.filter((i) => i.tick <= tick);
}

export function incidentOutcome(incident: Incident, tick: number): Incident["outcome"] | "pending" {
  return incident.resolvedTick !== null && incident.resolvedTick <= tick ? incident.outcome : "pending";
}

export function playbackStatus(run: Run, tick: number, playing: boolean): "Playing" | "Completed" | "Paused" {
  return playing ? "Playing" : tick === run.snapshots.length - 1 && run.status === "completed" ? "Completed" : "Paused";
}

export function feedEvents(run: Run, tick: number): RunEvent[] {
  return run.events.filter((e) => e.tick <= tick).slice(-20).reverse();
}

export function boardEvents(run: Run, tick: number): RunEvent[] {
  return run.events.filter((e) => e.tick <= tick && (e.type === "claim" || e.type === "intervention"));
}

export function wealthBars(world: World) {
  const residents = world.agents
    .filter((a) => a.role === "resident")
    .map((a) => ({ name: a.name, coins: a.inventory.coins, color: a.color }));
  const top = Math.max(40, ...residents.map((x) => x.coins));
  return residents.map((a) => ({ ...a, width: (a.coins / top) * 100 }));
}

export function canAskModel(input: {
  ready: boolean;
  mode: ResearchMode;
  playing: boolean;
  queued: boolean;
  busy: boolean;
  run: Run;
  tick: number;
}): boolean {
  const { ready, mode, playing, queued, busy, run, tick } = input;
  return (
    ready &&
    mode === "worker" &&
    !playing &&
    !queued &&
    !busy &&
    run.incidents.some((i) => ["pending", "checking"].includes(i.decision) && i.deadline > tick)
  );
}
```

If `World` is not exported under that name from `lib/sim/types.ts`, use the snapshot element type `Run["snapshots"][number]` and keep the function names.

- [ ] **Step 4: Run the unit tests**

Run: `node --experimental-strip-types --test tests/research-view-model.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Use the module in the observatory**

In `components/research/observatory.tsx` replace, with the matching function, and delete the local definitions:
- `validateSaved` and the hydrate effect's filter/slice with `const { runs, error } = parseSavedLibrary(localStorage.getItem(STORAGE)); if (error) setNotice("Saved runs could not be read. You can still start a new simulation."); else setLibrary(runs);` inside the same `setTimeout` (keep the `try` around `localStorage.getItem`, whose access can throw, routing that to the same notice).
- `save()`'s `next` with `addToLibrary(library, run)`.
- `start()`'s seed check with `const seed = parseSeed(draftSeed); if (seed === null) { setNotice(…); return; }`.
- the heading ternary with `researchHeading(view)`; the boundary ternary with `modeLabel(mode)`.
- `w` with `snapshotAt(run, tick)`; `nameIn` with the import; `incidentEvents` with `incidentEvents(run)`; `visibleIncidents` with `visibleIncidents(run, tick)`; `latestClaim` with `visibleIncidents(run, tick).at(-1)`; the "Find an incident" lookup with `nextIncidentEvent(run, tick)`.
- the incident card's `outcome` expression with `incidentOutcome(i, tick)`; the tick label status ternary with `playbackStatus(run, tick, playing)`.
- the event feed chain with `feedEvents(run, tick)`; the public board filter with `boardEvents(run, tick)`.
- the `wealth` memo body with `wealthBars(w)` (keep `useMemo` and its `[w]` dependency) and the bar `width` style with `` `${a.width}%` ``.
- the model button's `disabled` expression with `!canAskModel({ ready: !!provider?.ready, mode, playing, queued: !!queued, busy: modelBusy, run, tick })`.

- [ ] **Step 6: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --check components/research && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: clean; 36 browser tests pass; `ℹ fail 0`; no CSS output.

```bash
git checkout -b ui/research-view-model
git add components/research tests/research-view-model.test.mjs
git commit -m "refactor(research): pure view-model functions with unit tests"
git push -u origin ui/research-view-model
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Saved-run parsing and verification, library insertion, seed validation, headings and mode labels, incident lookup and outcomes, playback status, feed and board events, coin bars and the model-step gate leave the observatory as pure functions in components/research/research-view-model.ts with six node tests. Rendering unchanged; baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 4: `usePlayback` and `useModelContextTools`

**Files:**
- Create: `components/research/use-playback.ts`
- Create: `components/research/use-model-context.ts`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: `ResearchMode`, `WorkerRun` (Task 2); `advance`, `runToEnd`, `metrics` (`lib/sim/engine.ts`).
- Produces:

```ts
export type PlaybackState = { run: Run; tick: number; mode: ResearchMode; queued: Intervention | undefined };
export type Playback = PlaybackState & {
  last: number; playing: boolean; speed: string;
  setSpeed: (speed: string) => void;
  setPlaying: (playing: boolean) => void;
  seek: (tick: number) => void;           // pause, then clamp to 0..last
  step: () => void;                       // recorded and browser runs only; the composer routes worker steps
  queue: (action: Intervention) => void;
  openRecorded: (run: Run) => void;       // tick 0, recorded, paused, queue cleared
  startLocal: (run: Run) => void;         // browser mode, paused (the caller then calls resetCursor)
  receive: (update: WorkerRun) => void;   // worker mode, last tick, worker's running flag and queue
  resetCursor: () => void;                // tick 0, queue cleared
  current: () => PlaybackState;           // latest values for async handlers and tools
};
export function usePlayback(initial: Run): Playback;
// use-model-context.ts
export function useModelContextTools(state: () => { run: Run; tick: number; mode: ResearchMode }, jump: (tick: number) => void): void;
```

Every function in `Playback` is stable for the life of the component (`useCallback` with no changing dependencies), so `useLocalWorker` can hold `receive` safely.

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts`
Expected: 15 passed.

- [ ] **Step 2: Write `use-playback.ts`**

```ts
// components/research/use-playback.ts
"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { advance, runToEnd } from "@/lib/sim/engine";
import type { Intervention, Policy, Run, Scenario } from "@/lib/sim/types";
import type { ResearchMode, WorkerRun } from "./types";

export type PlaybackState = { run: Run; tick: number; mode: ResearchMode; queued: Intervention | undefined };
export type Playback = PlaybackState & {
  last: number;
  playing: boolean;
  speed: string;
  setSpeed: (speed: string) => void;
  setPlaying: (playing: boolean) => void;
  seek: (tick: number) => void;
  step: () => void;
  queue: (action: Intervention) => void;
  openRecorded: (run: Run) => void;
  startLocal: (run: Run) => void;
  receive: (update: WorkerRun) => void;
  resetCursor: () => void;
  current: () => PlaybackState;
};

/** The only writer of the displayed run, tick, play state, mode and queued intervention. */
export function usePlayback(initial: Run): Playback {
  const [run, setRun] = useState<Run>(() => initial);
  const [tick, setTick] = useState(initial.snapshots.length - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [mode, setMode] = useState<ResearchMode>("recorded");
  const [queued, setQueued] = useState<Intervention>();
  const ref = useRef<PlaybackState>({ run, tick, mode, queued });
  useLayoutEffect(() => {
    ref.current = { run, tick, mode, queued };
  }, [run, tick, mode, queued]);

  // A shared ?seed= link opens that recorded run from its first tick.
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = new URLSearchParams(location.search);
      if (!q.has("seed")) return;
      setRun(
        runToEnd({
          seed: Number(q.get("seed")),
          scenario: q.get("scenario") as Scenario,
          policy: q.get("policy") as Policy,
        }),
      );
      setTick(0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const step = useCallback(() => {
    const s = ref.current;
    const end = s.run.snapshots.length - 1;
    if (s.tick < end) {
      setTick((t) => Math.min(t + 1, end));
      return;
    }
    if (s.mode === "local" && s.run.status === "active") {
      const next = advance(s.run, s.queued);
      setRun(next);
      setTick(next.snapshots.length - 1);
      setQueued(undefined);
    } else setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || mode === "worker") return;
    const t = setInterval(step, 1000 / Number(speed));
    return () => clearInterval(t);
  }, [playing, speed, step, mode]);

  const seek = useCallback((t: number) => {
    setPlaying(false);
    setTick(Math.max(0, Math.min(t, ref.current.run.snapshots.length - 1)));
  }, []);
  const queue = useCallback((action: Intervention) => setQueued(action), []);
  const openRecorded = useCallback((r: Run) => {
    setRun(r);
    setTick(0);
    setMode("recorded");
    setPlaying(false);
    setQueued(undefined);
  }, []);
  const startLocal = useCallback((r: Run) => {
    setPlaying(false);
    setRun(r);
    setMode("local");
  }, []);
  const receive = useCallback((u: WorkerRun) => {
    setQueued(u.queued);
    setRun(u.run);
    setMode("worker");
    setTick(u.run.snapshots.length - 1);
    setPlaying(!!u.running);
  }, []);
  const resetCursor = useCallback(() => {
    setTick(0);
    setQueued(undefined);
  }, []);
  const current = useCallback(() => ref.current, []);

  return {
    run,
    tick,
    last: run.snapshots.length - 1,
    playing,
    speed,
    mode,
    queued,
    setSpeed,
    setPlaying,
    seek,
    step,
    queue,
    openRecorded,
    startLocal,
    receive,
    resetCursor,
    current,
  };
}
```

- [ ] **Step 3: Write `use-model-context.ts`**

```ts
// components/research/use-model-context.ts
"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { metrics } from "@/lib/sim/engine";
import type { Run } from "@/lib/sim/types";
import type { ResearchMode } from "./types";

type ModelContext = {
  registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> | void;
};

/**
 * Registers two tools with an in-page model context (document.modelContext) when the browser
 * provides one: read the visible run's status and metrics, and seek recorded playback to a tick.
 */
export function useModelContextTools(
  state: () => { run: Run; tick: number; mode: ResearchMode },
  jump: (tick: number) => void,
) {
  const latest = useRef({ state, jump });
  useLayoutEffect(() => {
    latest.current = { state, jump };
  });
  useEffect(() => {
    const mc = (document as unknown as { modelContext?: ModelContext }).modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    /* The two Promise.resolve(mc.registerTool({...}, { signal: lifecycle.signal })).catch(() => {})
       calls move here unchanged from the observatory, with `ref.current` → `latest.current.state()`
       and `exposed.current.jump(n)` → `latest.current.jump(n)`. */
    return () => lifecycle.abort();
  }, []);
}
```

Fill the comment with the two `registerTool` calls from the observatory's effect, byte for byte apart from the two substitutions.

- [ ] **Step 4: Use them in the observatory**

In `components/research/observatory.tsx`:
1. Replace the `run`, `tick`, `playing`, `speed`, `mode`, `queued` state, the `ref` + its layout effect, the `?seed=` part of the hydrate effect, `step`, the playback interval effect, `exposed` + its layout effect and the `registerTool` effect with:

```ts
  const playback = usePlayback(currentRun);
  const { run, tick, playing, speed, mode, queued, last } = playback;
```

2. Rewrite the handlers that wrote playback state:

```ts
  const workerStep = useCallback(() => void workerCommand("step"), [workerCommand]);
  const step = mode === "worker" ? workerStep : playback.step;
  function jump(t: number) {
    if (playback.current().mode === "worker") {
      setNotice("Save this worker run, then open its replay to rewind.");
      return;
    }
    playback.seek(t);
  }
  function toggle() {
    if (mode === "worker") void workerCommand(playing ? "pause" : "resume");
    else playback.setPlaying(!playing);
  }
  function intervene(action: Intervention) {
    if (mode === "worker") void workerCommand("intervene", action);
    else {
      playback.queue(action);
      setNotice("Intervention queued for the next new tick.");
    }
  }
  useModelContextTools(playback.current, jump);
```

   `attachWorker`, the stream `onmessage`, `workerCommand`'s success branch and `requestModelStep` call `playback.receive({ run, running, queued })` instead of their six setters; `openRun` calls `playback.openRecorded(r)`; `start()`'s local branch calls `playback.startLocal({ ...createRun(config), id: \`local-${crypto.randomUUID()}\` })` and its shared tail calls `playback.resetCursor()` in place of `setTick(0)` and `setQueued(undefined)`; the tab buttons call `playback.setPlaying(false)`; the speed select uses `playback.setSpeed`. Every `ref.current.run.id` becomes `playback.current().run.id`.
3. Import `usePlayback`, `useModelContextTools`; drop the now-unused imports (`npm run lint` lists them).

- [ ] **Step 5: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --write components/research/use-playback.ts components/research/use-model-context.ts components/research/observatory.tsx && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: clean; 36 browser tests pass, including the model-context test and both worker guard tests; `ℹ fail 0`; no CSS output.

```bash
git checkout -b ui/use-playback
git add components/research
git commit -m "refactor(research): usePlayback owns the displayed run; model-context tools in their own hook"
git push -u origin ui/use-playback
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "usePlayback becomes the only writer of run, tick, playing, speed, mode and queued, including the ?seed= start and the playback interval. The worker paths hand their runs to playback.receive. The in-page model-context tools move to use-model-context.ts. tests/e2e/observatory*.spec.ts and the baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 5: `useLocalWorker`

**Files:**
- Create: `components/research/use-local-worker.ts`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: `WorkerRun` (Task 2), `Playback.receive` (Task 4).
- Produces:

```ts
export const WORKER_URL = "http://127.0.0.1:8787";
export const workerOrigin: () => boolean;               // true on localhost:5173 / 127.0.0.1:5173
export type Provider = { ready: boolean; reason: string; model: string | null; dailyBudgetUSD: number | null; reservedUSD?: number } | null;
export type WorkerRunSummary = { id: string; name: string; tick: number; running: boolean };
export type NewRunConfig = { seed: number; scenario: Scenario; policy: BuiltInPolicy; maxTicks: number };
export type LocalWorker = {
  available: boolean; provider: Provider; runs: WorkerRunSummary[]; modelBusy: boolean;
  open: (id: string) => Promise<boolean>;           // true when attached
  create: (config: NewRunConfig) => Promise<boolean>;
  command: (action: string, intervention?: Intervention) => Promise<void>;
  modelStep: () => Promise<void>;
  detach: () => void;                                // invalidate pending requests and close the stream
};
export function useLocalWorker(options: { listRuns: boolean; onRun: (u: WorkerRun) => void; onNotice: (text: string) => void }): LocalWorker;
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory-worker.spec.ts`
Expected: 6 passed.

- [ ] **Step 2: Write the hook**

```ts
// components/research/use-local-worker.ts
"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BuiltInPolicy, Intervention, Run, Scenario } from "@/lib/sim/types";
import type { WorkerRun } from "./types";

export const WORKER_URL = "http://127.0.0.1:8787";
// The optional research worker is reachable only from a local checkout.
export const workerOrigin = () =>
  ["http://localhost:5173", "http://127.0.0.1:5173"].includes(location.origin);

export type Provider = {
  ready: boolean;
  reason: string;
  model: string | null;
  dailyBudgetUSD: number | null;
  reservedUSD?: number;
} | null;
export type WorkerRunSummary = { id: string; name: string; tick: number; running: boolean };
export type NewRunConfig = { seed: number; scenario: Scenario; policy: BuiltInPolicy; maxTicks: number };
type Attached = { run: Run; version: number; running?: boolean; queued?: Intervention };

/**
 * Every request to the local worker. Runs reach the screen only through onRun.
 * `session` invalidates everything in flight when the player leaves a worker run;
 * `load` lets only the latest open or create win; `revision` drops replies older than the stream.
 */
export function useLocalWorker({ listRuns, onRun, onNotice }: {
  listRuns: boolean;
  onRun: (update: WorkerRun) => void;
  onNotice: (text: string) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [provider, setProvider] = useState<Provider>(null);
  const [runs, setRuns] = useState<WorkerRunSummary[]>([]);
  const [modelBusy, setModelBusy] = useState(false);
  const session = useRef(0), load = useRef(0), revision = useRef(0);
  const attachedId = useRef<string | null>(null);
  const stream = useRef<EventSource | null>(null);
  const handlers = useRef({ onRun, onNotice });
  useLayoutEffect(() => {
    handlers.current = { onRun, onNotice };
  });

  useEffect(() => {
    if (workerOrigin())
      fetch(`${WORKER_URL}/health`).then((r) => r.ok && setAvailable(true)).catch(() => {});
    if (workerOrigin())
      fetch(`${WORKER_URL}/model/status`)
        /* the .then(r => r.ok ? r.json() : r.status === 404 ? {…restart message…} : null)
           .then(data => setProvider(data as Provider)).catch(() => setProvider(null)) chain
           moves here unchanged from the observatory's hydrate effect */;
    return () => {
      // Invalidate asynchronous requests using the current session, not the mount's value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      session.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      load.current++;
      stream.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!workerOrigin() || !listRuns) return;
    fetch(`${WORKER_URL}/runs`)
      .then(async (r) => {
        if (!r.ok) return;
        setAvailable(true);
        setRuns(((await r.json()) as { runs: WorkerRunSummary[] }).runs);
      })
      .catch(() => setAvailable(false));
  }, [listRuns]);

  const attach = useCallback((data: Attached) => {
    const s = ++session.current;
    stream.current?.close();
    revision.current = data.version;
    attachedId.current = data.run.id;
    handlers.current.onRun({ run: data.run, running: !!data.running, queued: data.queued });
    const es = new EventSource(`${WORKER_URL}/runs/${data.run.id}/stream`);
    stream.current = es;
    es.onmessage = (e) => {
      const update = JSON.parse(e.data);
      if (s === session.current && update.run && update.run.id === data.run.id && update.version >= revision.current) {
        revision.current = update.version;
        handlers.current.onRun({ run: update.run, running: update.running, queued: update.queued });
      }
    };
    es.onerror = () => {
      if (s === session.current) handlers.current.onNotice("Worker stream disconnected. Reconnecting automatically.");
    };
  }, []);

  const detach = useCallback(() => {
    session.current++;
    stream.current?.close();
  }, []);

  const open = useCallback(async (id: string) => {
    const s = session.current, request = ++load.current;
    try {
      const res = await fetch(`${WORKER_URL}/runs/${id}`);
      if (!res.ok) throw Error("Cannot load worker run");
      const data = (await res.json()) as Attached;
      if (s !== session.current || request !== load.current) return false;
      attach(data);
      return true;
    } catch (e) {
      if (s === session.current && request === load.current)
        handlers.current.onNotice(e instanceof Error ? e.message : "Worker unavailable");
      return false;
    }
  }, [attach]);

  const create = useCallback(async (config: NewRunConfig) => {
    const s = session.current, request = ++load.current;
    try {
      const res = await fetch(`${WORKER_URL}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = (await res.json()) as Attached & { error?: string };
      if (!res.ok) throw Error(data.error || "Cannot create worker run");
      if (s !== session.current || request !== load.current) return false;
      attach(data);
      return true;
    } catch (e) {
      if (s === session.current && request === load.current)
        handlers.current.onNotice(e instanceof Error ? e.message : "Worker unavailable");
      return false;
    }
  }, [attach]);

  const command = useCallback(async (action: string, intervention?: Intervention) => {
    /* the body of the observatory's workerCommand, unchanged except:
       runId = attachedId.current; revisionRef → revision; sessionRef → session;
       the success branch calls handlers.current.onRun({ run: data.run, running: data.running, queued: data.queued });
       setNotice → handlers.current.onNotice */
  }, []);

  const modelStep = useCallback(async () => {
    /* the body of the observatory's requestModelStep, unchanged except:
       id = attachedId.current; setModelBusy stays; attachWorker(data) → attach(data);
       setNotice → handlers.current.onNotice */
  }, [attach]);

  return { available, provider, runs, modelBusy, open, create, command, modelStep, detach };
}
```

Fill each comment with the named body from the observatory, applying only the listed substitutions. `attachedId` replaces the observatory's `ref.current.run.id` in `command` and `modelStep`: both are only reachable while a worker run is attached, and in that state the displayed run is the attached one.

- [ ] **Step 3: Use it in the observatory**

Replace `workerAvailable`, `workerRuns`, `provider`, `modelBusy`, `sessionRef`, `loadRef`, `streamRef`, `revisionRef`, the worker part of the hydrate effect and its cleanup, the runs-list effect, `attachWorker`, `openWorker`, `workerCommand`, `requestModelStep` and the worker branch of `start()` with:

```ts
  const worker = useLocalWorker({ listRuns: view === "library" || newOpen, onRun: playback.receive, onNotice: setNotice });
```

and rewrite the callers:
- `openRun(r)`: `worker.detach(); playback.openRecorded(r); setView("observatory"); select("mira");`
- `start(useWorker)`: after `parseSeed` and `setStarting(true)`, `if (useWorker) { if (!(await worker.create(config))) return; } else { worker.detach(); playback.startLocal({ ...createRun(config), id: \`local-${crypto.randomUUID()}\` }); }` then the tail `playback.resetCursor(); setView("observatory"); setNewOpen(false); select("mira");` inside the existing `try … finally { setStarting(false) }`.
- the library's connect button: `onClick={() => void worker.open(r.id).then((ok) => ok && setView("observatory"))}`.
- `workerCommand(…)` → `worker.command(…)`; `requestModelStep` → `worker.modelStep`; `modelBusy` → `worker.modelBusy`; `provider` → `worker.provider`; `workerAvailable` → `worker.available`; `workerRuns` → `worker.runs`; `workerOrigin` and `hosted`'s `workerOrigin` → the import from `./use-local-worker`.

`grep -n "8787" components/research/*.tsx` must print nothing; every request lives in the hook.

- [ ] **Step 4: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --write components/research/use-local-worker.ts components/research/observatory.tsx && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/research/use-local-worker.ts`
Expected: clean; 36 browser tests pass, all six worker tests among them; `ℹ fail 0`; no CSS output; hook ≤ 250 lines.

```bash
git checkout -b ui/use-local-worker
git add components/research
git commit -m "refactor(research): useLocalWorker owns every request to the local worker"
git push -u origin ui/use-local-worker
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Health, model status, the run list, open, create, commands, model steps and the EventSource stream move to components/research/use-local-worker.ts with the session, load and revision guards. Runs reach the screen only through usePlayback.receive. The six stubbed-worker tests (including the stale stream and stale command guards) and the baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 6: The three dialogs

**Files:**
- Create: `components/research/new-experiment-dialog.tsx`, `event-dialog.tsx`, `field-guide-dialog.tsx`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: `parseSeed`, `snapshotAt` (Task 3); `NewRunConfig` (Task 5).
- Produces:

```ts
export function NewExperimentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerAvailable: boolean;
  onStart: (config: NewRunConfig, useWorker: boolean) => Promise<void>;
  onNotice: (text: string) => void;
}): JSX.Element;
export function EventDialog(props: {
  run: Run; tick: number; eventId: string | null;
  onClose: () => void; onJump: (tick: number) => void; onSelect: (id: string) => void;
}): JSX.Element;
export function FieldGuideDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }): JSX.Element;
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts tests/e2e/gallery.spec.ts`
Expected: all pass.

- [ ] **Step 2: Write the three files**

```tsx
// components/research/new-experiment-dialog.tsx
"use client";
import { useState } from "react";
import { CheckCircle2, Play, Server } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { policyInfo, scenarioInfo } from "@/lib/sim/engine";
import { scenarioDescription } from "@/lib/sim/scenario-label";
import type { BuiltInPolicy, Scenario } from "@/lib/sim/types";
import { parseSeed } from "./research-view-model";
import type { NewRunConfig } from "./use-local-worker";

/** Scenario, policy and seed for a new simulation, run in the browser or on the local worker. */
export function NewExperimentDialog({ open, onOpenChange, workerAvailable, onStart, onNotice }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerAvailable: boolean;
  onStart: (config: NewRunConfig, useWorker: boolean) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const [draftScenario, setDraftScenario] = useState<Scenario>("scarcity");
  const [draftPolicy, setDraftPolicy] = useState<BuiltInPolicy>("baseline");
  const [draftSeed, setDraftSeed] = useState("42");
  const [starting, setStarting] = useState(false);
  async function start(useWorker = false) {
    const seed = parseSeed(draftSeed);
    if (seed === null) {
      onNotice("Choose a whole-number seed from 0 to 999999.");
      return;
    }
    setStarting(true);
    try {
      await onStart({ seed, scenario: draftScenario, policy: draftPolicy, maxTicks: 60 }, useWorker);
    } finally {
      setStarting(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* <DialogContent className="new-run-dialog"> … </DialogContent> moved unchanged from the observatory */}
    </Dialog>
  );
}
```

```tsx
// components/research/event-dialog.tsx
"use client";
import { ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Run } from "@/lib/sim/types";
import { snapshotAt } from "./research-view-model";

/** The recorded evidence behind an event, with a jump to its tick. */
export function EventDialog({ run, tick, eventId, onClose, onJump, onSelect }: {
  run: Run;
  tick: number;
  eventId: string | null;
  onClose: () => void;
  onJump: (tick: number) => void;
  onSelect: (id: string) => void;
}) {
  const activeEvent = run.events.find((e) => e.id === eventId);
  const agents = snapshotAt(run, tick).agents;
  return (
    <Dialog open={!!activeEvent} onOpenChange={(v) => !v && onClose()}>
      {/* <DialogContent className="evidence-dialog"> … </DialogContent> moved unchanged; the "Go to this tick" handler becomes:
          if (activeEvent) { onJump(activeEvent.tick); if (agents.some((a) => a.id === activeEvent.actor)) onSelect(activeEvent.actor); } onClose(); */}
    </Dialog>
  );
}
```

```tsx
// components/research/field-guide-dialog.tsx
"use client";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** How to read the research desk, with the link to the verified-report gallery. */
export function FieldGuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* <DialogContent className="guide-dialog"> … </DialogContent> moved unchanged */}
    </Dialog>
  );
}
```

Fill each comment with the matching `<DialogContent>` block from the observatory, byte for byte apart from the substitutions named: in the new-experiment dialog `onClick={() => void start()}` and `onClick={() => void start(true)}` stay, `workerAvailable` is the prop.

- [ ] **Step 3: Use them in the observatory**

Replace the three `<Dialog>` blocks with:

```tsx
      <NewExperimentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workerAvailable={worker.available}
        onStart={start}
        onNotice={setNotice}
      />
      <EventDialog run={run} tick={tick} eventId={eventId} onClose={() => setEventId(null)} onJump={jump} onSelect={select} />
      <FieldGuideDialog open={helpOpen} onOpenChange={setHelpOpen} />
```

and reduce the observatory's `start` to `async function start(config: NewRunConfig, useWorker: boolean)`: the worker or browser branch from Task 5 followed by the shared tail; the draft state, `starting` and the seed check now live in the dialog. Delete `activeEvent`, the draft states, `starting`, and the imports lint reports unused.

- [ ] **Step 4: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --write components/research && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/research/*dialog.tsx`
Expected: clean; 36 browser tests pass; `ℹ fail 0`; no CSS output; each dialog within its limit.

```bash
git checkout -b ui/research-dialogs
git add components/research
git commit -m "refactor(research): extract the new-experiment, evidence and field-guide dialogs"
git push -u origin ui/research-dialogs
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The three research dialogs move to their own files. The new-experiment dialog owns its draft scenario, policy, seed and starting state and validates the seed with parseSeed. Markup unchanged; tests/e2e and the baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 7: `ResearchTabs`, `RunOverview`, `PlaybackTimeline`, `ModelReadiness`

**Files:**
- Create: `components/research/research-tabs.tsx`, `run-overview.tsx`, `playback-timeline.tsx`, `model-readiness.tsx`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: `Playback` (Task 4); `Provider`, `workerOrigin` (Task 5); view-model functions (Task 3).
- Produces:

```ts
export function ResearchTabs(props: {
  view: string; mode: ResearchMode; busy: boolean;
  onExit: () => void; onView: (view: string) => void; onNew: () => void; onHelp: () => void;
}): JSX.Element;
export function RunOverview(props: {
  run: Run; tick: number; mode: ResearchMode; selected: string;
  onSelect: (id: string) => void; onJump: (tick: number) => void; onEvidence: (id: string) => void; onNotice: (text: string) => void;
}): JSX.Element;
export function PlaybackTimeline(props: {
  playback: Playback; busy: boolean;
  onJump: (tick: number) => void; onToggle: () => void; onStep: () => void;
  onIntervene: (action: Intervention) => void; onSave: () => void; onNotice: (text: string) => void;
}): JSX.Element;
export function ModelReadiness(props: {
  run: Run; tick: number; mode: ResearchMode; playing: boolean; queued: boolean;
  provider: Provider; busy: boolean; onAsk: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts tests/e2e/visual.spec.ts`
Expected: all pass.

- [ ] **Step 2: Write the four region files**

Each file is `"use client";`, its imports, a one-line doc comment and a function with the props above that returns the moved markup. The moved blocks and their only substitutions:

| File | Moves (from the observatory's JSX, in order) | Substitutions |
|---|---|---|
| `research-tabs.tsx` | `<header className="research-heading">`, `<div className="research-tabs">`, `<button className="text-button research-help">`, `<div className="research-boundary">`, wrapped in a fragment | heading ternary → `researchHeading(view)`; boundary ternary → `modeLabel(mode)`; tab `onClick` → `onView(id)`; `modelBusy` → `busy`; `setNewOpen(true)` → `onNew()`; `setHelpOpen(true)` → `onHelp()`; `onExit` stays |
| `run-overview.tsx` | `<div className="scenario-strip">`, `<section className="world-layout">`, in a fragment | `w` → `snapshotAt(run, tick)`; the "Find an incident" handler: `const e = nextIncidentEvent(run, tick); if (e) { onJump(e.tick); onSelect(e.target \|\| "rook"); } else onNotice(…same two messages…)`; `select` → `onSelect`; `setEventId` → `onEvidence` |
| `playback-timeline.tsx` | `<section className="timeline">`, `<div className="run-toolbar">`, in a fragment | `run`, `tick`, `last`, `playing`, `mode`, `speed`, `queued` from `playback`; `jump(` → `onJump(`; `toggle` → `onToggle`; `step` → `onStep`; `modelBusy` → `busy`; `setSpeed` → `playback.setSpeed`; `save` → `onSave`; `intervene(` → `onIntervene(`; `setNotice(` → `onNotice(`; markers map over `incidentEvents(run)`; status → `playbackStatus(run, tick, playing)` |
| `model-readiness.tsx` | `<section className="model-readiness">` | owns `RUN_LOCALLY` and `hosted` (`useSyncExternalStore(noSubscription, () => !workerOrigin(), () => false)`); `w.agents` → `snapshotAt(run, tick).agents`; `requestModelStep()` → `onAsk()`; `modelBusy` → `busy`; `disabled={!canAskModel({ ready: !!provider?.ready, mode, playing, queued, busy, run, tick })}` |

Move each block byte for byte apart from the substitutions in its row.

- [ ] **Step 3: Use them in the observatory**

Replace the moved blocks with:

```tsx
      <ResearchTabs
        view={view}
        mode={mode}
        busy={worker.modelBusy}
        onExit={onExit}
        onView={(id) => {
          if (mode !== "worker") playback.setPlaying(false);
          setView(id);
        }}
        onNew={() => setNewOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />
```

and, inside `view === "observatory"`:

```tsx
          <RunOverview run={run} tick={tick} mode={mode} selected={selected} onSelect={select} onJump={jump} onEvidence={setEventId} onNotice={setNotice} />
          <PlaybackTimeline
            playback={playback}
            busy={worker.modelBusy}
            onJump={jump}
            onToggle={toggle}
            onStep={step}
            onIntervene={intervene}
            onSave={save}
            onNotice={setNotice}
          />
          <ModelReadiness
            run={run}
            tick={tick}
            mode={mode}
            playing={playing}
            queued={!!queued}
            provider={worker.provider}
            busy={worker.modelBusy}
            onAsk={() => void worker.modelStep()}
          />
```

Delete `RUN_LOCALLY`, `noSubscription`, `hosted` and the unused imports from the observatory.

- [ ] **Step 4: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --write components/research && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/research/{research-tabs,run-overview,playback-timeline,model-readiness}.tsx`
Expected: clean; 36 browser tests pass, the research baseline unchanged; `ℹ fail 0`; no CSS output; each file within its limit.

```bash
git checkout -b ui/research-regions-top
git add components/research
git commit -m "refactor(research): extract ResearchTabs, RunOverview, PlaybackTimeline and ModelReadiness"
git push -u origin ui/research-regions-top
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The heading and tools, the scenario strip with residents and inspector, the playback transport with its toolbar, and the live-model panel move to their own files under components/research. DOM order and markup unchanged; tests/e2e and the three baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 8: `ActivityPanel`, `MetricsPanel`, `RunLibrary` and `useSavedRuns`

**Files:**
- Create: `components/research/activity-panel.tsx`, `metrics-panel.tsx`, `run-library.tsx`
- Modify: `components/research/observatory.tsx`

**Interfaces:**
- Consumes: view-model functions (Task 3); `WorkerRunSummary` (Task 5).
- Produces:

```ts
export function ActivityPanel(props: {
  run: Run; tick: number; mode: ResearchMode;
  onJump: (tick: number) => void; onToggle: () => void; onNew: () => void;
  onSelect: (id: string) => void; onEvidence: (id: string) => void;
}): JSX.Element;
export function MetricsPanel(props: { run: Run; tick: number; onCompare: () => void }): JSX.Element;
export function useSavedRuns(onNotice: (text: string) => void): { runs: Run[]; save: (run: Run) => void };
export function RunLibrary(props: {
  currentRun: Run; saved: Run[]; workerRuns: WorkerRunSummary[];
  onOpen: (run: Run) => void; onOpenWorker: (id: string) => void;
}): JSX.Element;
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx playwright test tests/e2e/observatory.spec.ts tests/e2e/observatory-worker.spec.ts`
Expected: 15 passed.

- [ ] **Step 2: Write the three files**

| File | Moves | Substitutions |
|---|---|---|
| `activity-panel.tsx` | `<section className="activity-panel">` | `visibleIncidents` → `visibleIncidents(run, tick)`; `latestClaim` → its `.at(-1)`; `last` → `run.snapshots.length - 1`; `w.agents` → `snapshotAt(run, tick).agents`; `outcome` → `incidentOutcome(i, tick)`; feed chain → `feedEvents(run, tick)`; board filter → `boardEvents(run, tick)`; `jump(` → `onJump(`; `setNewOpen(true)` → `onNew()`; `toggle()` → `onToggle()`; `select(` → `onSelect(`; `setEventId(` → `onEvidence(` |
| `metrics-panel.tsx` | `<aside className="metrics-panel">` and `function CoinsLegend` | owns `const m = metrics(run, tick)` and `const wealth = useMemo(() => wealthBars(snapshotAt(run, tick)), [run, tick])`; bar width → `` `${a.width}%` ``; `setView("experiments")` → `onCompare()` |
| `run-library.tsx` | `<section className="library-panel">` and `defaultRun` | `library` → `saved`; `workerAvailable && workerRuns.length > 0` → `workerRuns.length > 0`; `openWorker(r.id)` → `onOpenWorker(r.id)`; `openRun(` → `onOpen(` |

`run-library.tsx` also exports the saved-runs hook:

```ts
const STORAGE = "settlement-library-v1";

/** Saved runs in this browser: loaded once (only runs that replay exactly) and saved newest first. */
export function useSavedRuns(onNotice: (text: string) => void) {
  const [runs, setRuns] = useState<Run[]>([]);
  const notify = useRef(onNotice);
  useLayoutEffect(() => {
    notify.current = onNotice;
  });
  useEffect(() => {
    const hydrate = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(STORAGE);
      } catch {
        notify.current("Saved runs could not be read. You can still start a new simulation.");
        return;
      }
      const { runs: loaded, error } = parseSavedLibrary(raw);
      if (error) notify.current("Saved runs could not be read. You can still start a new simulation.");
      else setRuns(loaded);
    }, 0);
    return () => clearTimeout(hydrate);
  }, []);
  const save = useCallback((run: Run) => {
    setRuns((library) => {
      const next = addToLibrary(library, run);
      try {
        localStorage.setItem(STORAGE, JSON.stringify(next));
        notify.current("Run saved to this browser. Export a copy to keep it elsewhere.");
        return next;
      } catch {
        notify.current("Browser storage is full. Use Export run to save a file.");
        return library;
      }
    });
  }, []);
  return { runs, save };
}
```

- [ ] **Step 3: Use them in the observatory**

```tsx
          <div className="lower-grid">
            <ActivityPanel run={run} tick={tick} mode={mode} onJump={jump} onToggle={toggle} onNew={() => setNewOpen(true)} onSelect={select} onEvidence={setEventId} />
            <MetricsPanel run={run} tick={tick} onCompare={() => setView("experiments")} />
          </div>
```

```tsx
      {view === "library" && (
        <RunLibrary
          currentRun={currentRun}
          saved={saved.runs}
          workerRuns={worker.available ? worker.runs : []}
          onOpen={openRun}
          onOpenWorker={(id) => void worker.open(id).then((ok) => ok && setView("observatory"))}
        />
      )}
```

with `const saved = useSavedRuns(setNotice);` and `onSave={() => saved.save(run)}` on the timeline. Delete `library`, `STORAGE`, the hydrate effect, `save`, `wealth`, `m`, `defaultRun`, `CoinsLegend`, and the imports lint reports unused.

- [ ] **Step 4: Verify and ship**

Run: `npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --write components/research && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/research/*.tsx components/research/*.ts`
Expected: clean; 36 browser tests pass, including save-and-reload and unreadable storage; `ℹ fail 0`; no CSS output; every file within its limit.

```bash
git checkout -b ui/research-regions-bottom
git add components/research
git commit -m "refactor(research): extract ActivityPanel, MetricsPanel and RunLibrary with useSavedRuns"
git push -u origin ui/research-regions-bottom
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The incident log with feed and board, the village metrics, and the archive move to their own files; saved-run loading and saving become useSavedRuns in run-library.tsx. Markup unchanged; tests/e2e and the baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 9: Composer, shim removal, size and cycle checks, measurement, docs

**Files:**
- Modify: `components/research/observatory.tsx`
- Delete: `components/observatory.tsx`
- Modify: `components/game/research-overlay.tsx`, `components/game/campaign-view-model.ts` (import path only)
- Modify: `tests/component-size.test.mjs`
- Modify: `docs/ui-architecture-verification.md`, `docs/superpowers/specs/2026-10-10-ui-architecture-design.md`, `README.md`, `CHANGELOG.md`, `docs/product-roadmap.md`

- [ ] **Step 1: Write the failing size and cycle rows**

In `tests/component-size.test.mjs` add to `limits`:

```js
  "components/research/observatory.tsx": 250,
  "components/research/types.ts": 100,
  "components/research/use-playback.ts": 200,
  "components/research/use-local-worker.ts": 250,
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
```

and generalise `importCycles` so the directory comes from each file (`dep` resolves `./x` against the importing file's directory) and add:

```js
test("the research region files have no import cycle", () => {
  const files = Object.keys(limits).filter((f) => f.startsWith("components/research/"));
  assert.deepEqual(importCycles(files, (f) => readFileSync(f, "utf8")), []);
});
```

Run: `node --experimental-strip-types --test tests/component-size.test.mjs`
Expected: FAIL while `observatory.tsx` is over 250 lines.

- [ ] **Step 2: Finish the composer**

The composer keeps: the props, `view`/`setView`/`select`/`selected` aliases, `newOpen`, `helpOpen`, `eventId`, `notice` and its 6 s timer, the `onFrame` effect, `usePlayback`, `useLocalWorker`, `useSavedRuns`, `useModelContextTools`, the worker-mode branching (`step`, `jump`, `toggle`, `intervene`), `openRun`, `start`, and the layout. Read it top to bottom once; delete any dead variable or import. Run `wc -l components/research/observatory.tsx`. If it is over 250, apply the Global Constraints rule (raise to the measured length rounded up to 10, ledger a ruling, update the spec row and the size test in this PR).

- [ ] **Step 3: Point the campaign at the new path and remove the shim**

- `components/game/research-overlay.tsx`: `import type { ResearchFrame } from "../observatory";` → `"../research/types"`; `import("../observatory")` → `import("../research/observatory")`.
- `components/game/campaign-view-model.ts`: `import type { ResearchFrame } from "../observatory";` → `"../research/types.ts"`.
- `git rm components/observatory.tsx`. `grep -rn "components/observatory\|\.\./observatory\"" components app` prints nothing.

- [ ] **Step 4: Run everything**

Run: `node --experimental-strip-types --test tests/component-size.test.mjs && npm run lint && npm run typecheck && npx --yes prettier@3.6.2 --check components/research && pkill -f next-server; npm run build && npx playwright test && npm test 2>&1 | tail -3 && npm run evaluate -- --verify docs/evaluation-results.json | tail -1 && npm run eval:agent -- --verify public/examples/agent-report.json | tail -1 && git diff --stat -M main -- '*.css'`
Expected: size and cycle tests pass; lint, typecheck, Prettier clean; 36 browser tests with the baselines unchanged; `ℹ fail 0`; `Verified 120 cases`; `Verified 40 cases`; no CSS output.

- [ ] **Step 5: Measure**

Run: `(npm start &) && sleep 5 && npm run measure:ui -- --out /tmp/ui-after-plan2.json; pkill -f next-server`, twice, a minute apart.
Expected: two tables. Paste both under "After Plan 2 (research split)" in `docs/ui-architecture-verification.md` with commit, machine, Node and Chromium, and state the run-to-run band. No memo is tried in this plan: the playback regions take `run` and `tick`, which change every tick, as the footer did in Plan 1.

- [ ] **Step 6: Docs**

- Spec research table: add `run-overview.tsx` (120) and `use-model-context.ts` (100) rows; change `run-library.tsx` to "The archive view: the campaign's record, the reference run, worker runs and saved runs, with open and export; and `useSavedRuns`."; change `research-tabs.tsx` to also mention the field-guide button and the boundary strip; change the opening paragraph's future tense ("moves here in Plan 2") to the past.
- `README.md` layout block: add `components/research/           Research desk: playback, local worker, regions and view model`.
- `CHANGELOG.md` Unreleased: add a bullet: "**Research screen split.** `components/observatory.tsx` moved to `components/research/` and split into a composer, `usePlayback` (the only writer of the displayed run), `useLocalWorker` (every request to the optional local worker, with its session and revision guards), one file per region and a unit-tested view model. Fifteen new browser tests pin the screen, six of them against a stubbed worker. Markup, CSS and the screenshot baselines are unchanged."
- `docs/product-roadmap.md`: one line under the shipped list: "UI architecture: the campaign and research screens are split into composers, state hooks and one file per region, with size limits enforced by tests (0.10.0)."

- [ ] **Step 7: Commit, PR**

```bash
git checkout -b ui/research-composer
git add -A components/research components/observatory.tsx components/game/research-overlay.tsx components/game/campaign-view-model.ts tests/component-size.test.mjs docs/ui-architecture-verification.md docs/superpowers/specs/2026-10-10-ui-architecture-design.md README.md CHANGELOG.md docs/product-roadmap.md
git commit -m "refactor(research): finish the composer, remove the shim, enforce research file limits, record post-split measurement"
git push -u origin ui/research-composer
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Last extraction of the research split: the composer holds only view, dialogs, notice, worker-mode branching and layout; the campaign imports components/research directly and the components/observatory.tsx shim is gone. tests/component-size.test.mjs enforces every research file's limit and checks the research directory for import cycles. docs/ui-architecture-verification.md gains the after-Plan-2 measurements. Spec, README, CHANGELOG and roadmap updated.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 10: Release 0.10.0

**Files:**
- Modify: `CHANGELOG.md`, `package.json`, `packages/settlement-testbed/package.json`, `action.yml` (through `npm version`), `packages/settlement-testbed/README.md` (regenerated)

- [ ] **Step 1: Version and changelog**

```bash
git checkout -b chore/ui-architecture-0.10.0
npm version 0.10.0 --no-git-tag-version
npm run check:versions
```

Expected: `versions agree: 0.10.0`. In `CHANGELOG.md` rename `## Unreleased` to `## 0.10.0 — <today's date, YYYY-MM-DD>` and add a closing line under its bullets: "Gameplay, scenarios, the protocol, saves and existing reports are unchanged." Regenerate the package README with `npm run build:readme --prefix packages/settlement-testbed` if that script exists (check `packages/settlement-testbed/package.json`), else `node scripts/build-package-readme.mjs`, and confirm `node --experimental-strip-types --test tests/package-readme.test.mjs` passes.

- [ ] **Step 2: Verify, commit, PR, merge, tag**

Run: `npm run lint && npm run typecheck && npm test 2>&1 | tail -3 && npm run check:versions`
Expected: clean; `ℹ fail 0`; `versions agree: 0.10.0`.

```bash
git add CHANGELOG.md package.json package-lock.json packages/settlement-testbed action.yml
git commit -m "chore(release): UI architecture 0.10.0"
git push -u origin chore/ui-architecture-0.10.0
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Release 0.10.0: the campaign and research screens split into composers, state hooks and one file per region (UI architecture sub-project). No gameplay, protocol, save or report change.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`, then:

```bash
git tag -a v0.10.0 -m "Settlement v0.10.0 — UI architecture"
git push origin v0.10.0
```

Watch the Release workflow (`gh run list -R Lingikaushikreddy/Settlement-Village --workflow Release --limit 1`) to success and confirm `gh release view v0.10.0 -R Lingikaushikreddy/Settlement-Village` shows a published, non-draft release. The npm publish job skips until the package's first manual publish, as for 0.7.0 to 0.9.0.

---

## Self-review

- **Spec coverage.** Research table: every row has a creating task (composer 2–9, types 2, use-playback 4, use-local-worker 5, research-tabs/playback-timeline/model-readiness 7, activity/metrics/run-library 8, the three dialogs 6, view model 3); the two added files and the library wording are listed under "Deliberate departures" and written into the spec in Task 9. State and data flow: `usePlayback` is the only writer of run and tick and the worker delivers through `receive` (Tasks 4–5); nothing outside `use-local-worker.ts` calls the worker (Task 5 grep). Performance policy: measured after the split, no memo tried, reason recorded (Task 9). Testing: characterization before extraction (Task 1), unit tests for the view model (Task 3), size and cycle checks (Task 9), baselines and CSS diff on every PR. Delivery: one PR per task; 0.10.0 release with CHANGELOG, verification doc, roadmap and README (Tasks 9–10). Astra-6 candidates: Tasks 6, 7, 8 once Task 5 has merged.
- **Placeholders.** Moved JSX is named by its exact `className` anchor, with every substitution listed; the bodies of `command`, `modelStep` and the `registerTool` calls are named functions moved verbatim with their substitutions spelled out.
- **Type consistency.** `ResearchMode`, `ResearchFrame`, `WorkerRun` (Task 2) are used by Tasks 3–9; `Playback` and `PlaybackState` (Task 4) by Tasks 5, 7, 9; `Provider`, `WorkerRunSummary`, `NewRunConfig`, `workerOrigin` (Task 5) by Tasks 6–8; `parseSeed`, `snapshotAt` and the rest (Task 3) by Tasks 6–8.
- **Review Focus.** Items 1, 2 and 5 are Task 1 e2e tests re-run by every later task; items 3 and 4 have unit tests in Task 3 and e2e tests in Task 1.
