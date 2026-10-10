# UI Architecture, Plan 1: Campaign Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `components/game/game.tsx` (1,421 lines) into a thin composer, a state hook, one file per visible region and a tested view-model module, with no change to behaviour, CSS or the three screenshot baselines.

**Architecture:** `useCampaign` owns the game ref, the 200 ms loop, autosave and the command path. The composer keeps the shared UI state (selected building, open panel, placing, open flags) and lays out regions that receive plain props. Logic that needs unit tests lives in `campaign-view-model.ts` and runs under `node --test`. Behaviour is pinned by Playwright before each extraction. A measurement script records Chrome performance metrics before and after; memoization is added only where it shows a drop.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Playwright 1.64 (Chromium), `node --experimental-strip-types --test`, Chrome DevTools Protocol through Playwright's `newCDPSession`.

**Spec:** `docs/superpowers/specs/2026-10-10-ui-architecture-design.md`

## Global Constraints

- Engine behaviour, the agent protocol, the report format and the scenario schema do not change; `npm run evaluate -- --verify docs/evaluation-results.json` and `npm run eval:agent -- --verify public/examples/agent-report.json` pass at the end of every task.
- The campaign save format, the `CampaignSession` lock and recovery flow, and the URL parameters `seed`, `scenario`, `policy`, `view`, `report` do not change.
- No CSS file changes. In this plan no CSS file moves either: the four imports (`game.css`, `research.css`, `session.css`, `polish.css`) stay in `components/game/game.tsx` in their current order. `git diff --stat -M main -- '*.css'` is empty in every PR.
- The three screenshot baselines in `tests/e2e/visual.spec.ts-snapshots/` are never re-captured. `npm run test:e2e` passes in every task.
- No new dependencies.
- `components/game/scene.tsx`, `crew.tsx`, `council.tsx`, `village-journal.tsx`, `development-panel.tsx` and `components/experiments.tsx` are not edited.
- File size limits (lines, counted with `wc -l`): `game.tsx` 300, `session-gate.tsx` 200, `use-campaign.ts` 250, `campaign-hud.tsx` 200, `selection-panel.tsx` 250, `campaign-footer.tsx` 150, `campaign-dialogs.tsx` 300, `guide.tsx` 200, `research-overlay.tsx` 150, `campaign-view-model.ts` 150, plus `battle-overlay.tsx` 250 (added by this plan; Task 9 adds the row to the spec).
- `React.memo` only with a recorded drop in `docs/ui-architecture-verification.md`.
- Each task is one pull request against the protected `main`: branch `ui/<task-slug>`, `gh pr create -R Lingikaushikreddy/Settlement-Village`, wait for CI, `gh pr merge --squash --delete-branch`, then `git checkout main && git pull`. Commits and PRs carry no assistant attribution. Every PR body ends with the line `CSS diff: none` after the executor has run `git diff --stat -M main -- '*.css'` and seen no output.
- Prettier formatting as the repo uses it (2-space, double quotes, trailing commas); run `npm run lint` and `npm run typecheck` before every commit.

## Review Focus

1. A save exported before the split imports after it and resets every panel: the import path moves into `guide.tsx` and must still close research, council, crew, selection, placement and the dialog. Test in Task 2 (`imports a saved village from the guide`), re-run in Tasks 6 and 9.
2. Opening research through `?view=research` shows the "Recorded replay" caption and the Village button closes it; the caption text moves to the view model. Test in Task 2 (`opens research from the URL and returns to the village`).
3. The sound toggle flips its accessible name and stays flipped across re-renders once the state lives in the hook. Test in Task 2 (`toggles game sound`).
4. The toast's "Dismiss message" button clears a notice whose timer now lives in the hook. Test in Task 2 (`dismisses a notice`).
5. The size test must itself fail when a listed file grows past its limit, or it guards nothing. Test in Task 9 (`the size checker reports an oversize file`).

---

## File structure after this plan

```
components/game/
  game.tsx                 SettlementGame + CampaignGame composer (CSS imports stay here)
  session-gate.tsx         blocked / unsupported / recovery / unavailable card
  use-campaign.ts          game ref, loop, autosave, update/act, notice, saved, sound, chime
  campaign-view-model.ts   pure functions for the regions
  campaign-hud.tsx         header + settlement navigation
  campaign-footer.tsx      crew board, journal, badge, army dock, village actions
  selection-panel.tsx      placement notice + building panel
  campaign-dialogs.tsx     build / train / raid dialog
  guide.tsx                guide dialog content + save import input
  battle-overlay.tsx       battle banner, hint, controls, results dialog
  research-overlay.tsx     research caption + lazy Observatory mount
scripts/measure-ui.mjs     Chrome performance metrics on the production build
tests/campaign-view-model.test.mjs
tests/component-size.test.mjs
tests/measure-ui.test.mjs
tests/e2e/campaign.spec.ts
tests/e2e/fixtures/village-save.json
docs/ui-architecture-verification.md
```

---

### Task 1: Measurement script and baseline

**Files:**
- Create: `scripts/measure-ui.mjs`
- Create: `tests/measure-ui.test.mjs`
- Create: `docs/ui-architecture-verification.md`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run measure:ui -- --out <path> [--url http://127.0.0.1:5173] [--seconds 10]`; exported `delta(before, after)` and `formatTable(rows)` from the script.

- [ ] **Step 1: Write the failing unit test**

```js
// tests/measure-ui.test.mjs
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test tests/measure-ui.test.mjs`
Expected: FAIL with `Cannot find module` for `scripts/measure-ui.mjs`.

- [ ] **Step 3: Write the script**

```js
#!/usr/bin/env node
// scripts/measure-ui.mjs — Chrome performance metrics for the campaign and the observatory.
// Not a CI gate: numbers differ between machines. Run against the production build:
//   npm run build && npm start &   then   npm run measure:ui -- --out /tmp/ui-before.json
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

export const METRICS = ["ScriptDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "JSHeapUsedSize", "Timestamp"];

/** Difference between two Performance.getMetrics samples, durations in ms, heap in MB. */
export function delta(before, after) {
  const d = (k) => after[k] - before[k];
  return {
    scriptMs: Math.round(d("ScriptDuration") * 1000),
    taskMs: Math.round(d("TaskDuration") * 1000),
    layouts: d("LayoutCount"),
    styleRecalcs: d("RecalcStyleCount"),
    heapMB: d("JSHeapUsedSize") / 1e6,
    seconds: d("Timestamp"),
  };
}

export function formatTable(rows) {
  const lines = ["| Scene | Script ms | Task ms | Layouts | Style recalcs | Heap Δ MB | Seconds |", "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of rows)
    lines.push(`| ${r.scene} | ${r.scriptMs.toFixed(1)} | ${r.taskMs.toFixed(1)} | ${r.layouts} | ${r.styleRecalcs} | ${r.heapMB.toFixed(2)} | ${Math.round(r.seconds)} |`);
  return lines.join("\n");
}

async function sample(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]));
}

async function measure(page, scene, seconds) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto(scene.path);
  await scene.ready(page);
  await page.waitForTimeout(2000); // let the first paint and hydration settle
  const before = await sample(cdp);
  await page.waitForTimeout(seconds * 1000);
  const after = await sample(cdp);
  await cdp.detach();
  return { scene: scene.name, ...delta(before, after) };
}

const scenes = [
  { name: "campaign idle", path: "/", ready: (page) => page.getByLabel("gold: 1250").waitFor() },
  {
    name: "observatory playback",
    path: "/?view=research",
    ready: async (page) => {
      await page.getByRole("button", { name: "Rewind to beginning" }).click();
      await page.getByRole("button", { name: "Play" }).click();
    },
  },
];

async function main() {
  const { values } = parseArgs({
    options: { url: { type: "string", default: "http://127.0.0.1:5173" }, out: { type: "string" }, seconds: { type: "string", default: "10" } },
  });
  const seconds = Number(values.seconds);
  try {
    await fetch(values.url);
  } catch {
    console.error(`Nothing is listening at ${values.url}. Run: npm run build && npm start`);
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: values.url, reducedMotion: "reduce", viewport: { width: 1280, height: 720 } });
  const rows = [];
  for (const scene of scenes) rows.push(await measure(page, scene, seconds));
  const chromiumVersion = browser.version();
  await browser.close();
  const result = { machine: `${process.platform} ${process.arch}`, node: process.version, chromium: chromiumVersion, at: new Date().toISOString(), rows };
  if (values.out) writeFileSync(values.out, JSON.stringify(result, null, 2) + "\n");
  console.log(formatTable(rows));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
```

Add to `package.json` scripts, after `"test:e2e"`:

```json
    "measure:ui": "node scripts/measure-ui.mjs",
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `node --experimental-strip-types --test tests/measure-ui.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Take the baseline**

Run (two terminals, or background the server): `npm run build && (npm start &) && sleep 5 && npm run measure:ui -- --out /tmp/ui-baseline.json; kill %1`
Expected: a two-row table printed; `/tmp/ui-baseline.json` written. If the observatory scene errors on the Play button, the recorded run is already at its end: the script rewinds first, so re-run and read the error text before changing anything.

- [ ] **Step 6: Write the verification doc**

```markdown
# UI architecture verification

Measurements from `npm run measure:ui` on the production build. Numbers are for one machine and are not a CI gate; compare rows within one table, not across tables from different machines.

## Baseline (before Plan 1)

Commit: <main sha>. Machine: <from the JSON `machine`>. Node: <from `node`>. Chromium: <from `chromium`>.

<paste the printed table>

## After Plan 1 (campaign split)

Pending.

## After Plan 2 (research split)

Pending.

## Memoization decisions

None yet. A `React.memo` is listed here with the measurement that justified it, or it is removed.
```

Fill the angle-bracket fields from the JSON and the printed table.

- [ ] **Step 7: Lint, typecheck, full suite, commit, PR**

Run: `npm run lint && npm run typecheck && npm test 2>&1 | tail -5`
Expected: clean; `ℹ fail 0`.

```bash
git checkout -b ui/measure-ui
git add scripts/measure-ui.mjs tests/measure-ui.test.mjs docs/ui-architecture-verification.md package.json
git commit -m "chore: UI performance measurement script and baseline"
git push -u origin ui/measure-ui
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Adds scripts/measure-ui.mjs (Chrome performance metrics over 10 s of campaign idle and observatory playback on the production build) and records the pre-split baseline in docs/ui-architecture-verification.md. Not a CI gate.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 2: Behavioural tests that pin the campaign before any extraction

**Files:**
- Create: `tests/e2e/campaign.spec.ts`
- Create: `tests/e2e/fixtures/village-save.json`

**Interfaces:**
- Consumes: current markup only (accessible names listed in the steps).
- Produces: the regression suite every later task runs.

- [ ] **Step 1: Generate the save fixture from the real factory**

Run:

```bash
node --experimental-strip-types -e '
import("./lib/game/economy.ts").then((m) => {
  const g = m.newGame();
  g.resources = { gold: 999, wood: 900, food: 750 };
  process.stdout.write(JSON.stringify(g, null, 2) + "\n");
});' > tests/e2e/fixtures/village-save.json
node --experimental-strip-types -e 'import("./lib/game/economy.ts").then((m) => { m.restoreGame(require("node:fs").readFileSync("tests/e2e/fixtures/village-save.json", "utf8")); console.log("fixture restores"); })'
```

Expected: `fixture restores`. If `restoreGame` throws, read its message: the fixture must be a valid version-2 save.

- [ ] **Step 2: Write the tests**

```ts
// tests/e2e/campaign.spec.ts
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixtures/village-save.json", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
});

test("builds from the Build dialog and places the building on the map", async ({ page }) => {
  await page.locator(".build-button").click();
  const dialog = page.getByRole("dialog", { name: "Make room for possibility." });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Watchtower/ }).click();
  await expect(page.getByText("Place your watchtower")).toBeVisible();
  await page.getByRole("button", { name: /^Place building at/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Builder on the way!" })).toBeVisible();
  await expect(page.getByLabel(/^gold: /)).not.toHaveAttribute("aria-label", "gold: 1250");
});

test("selects the town hall and reads its panel", async ({ page }) => {
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  const panel = page.locator(".building-panel");
  await expect(panel.getByRole("heading", { name: "Town hall" })).toBeVisible();
  await expect(panel.getByText("Level 1")).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Upgrade/ })).toBeVisible();
  await panel.getByRole("button", { name: "Close building details" }).click();
  await expect(panel).toHaveCount(0);
});

test("opens the guide from the banner", async ({ page }) => {
  await page.getByRole("button", { name: "Open village guide" }).click();
  await expect(page.getByRole("dialog", { name: "Welcome home, chief." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export save" })).toBeVisible();
});

test("imports a saved village from the guide", async ({ page }) => {
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  await expect(page.locator(".building-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open village guide" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole("status").filter({ hasText: "Village restored from your save." })).toBeVisible();
  await expect(page.getByLabel("gold: 999")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".building-panel")).toHaveCount(0);
});

test("opens research from the URL and returns to the village", async ({ page }) => {
  await page.goto("/?view=research");
  const caption = page.locator(".research-map-caption");
  await expect(caption.getByText("Recorded replay")).toBeVisible();
  await expect(page.locator(".build-button")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Settlement navigation" }).getByRole("button", { name: "Village" }).click();
  await expect(caption).toHaveCount(0);
  await expect(page.locator(".build-button")).toBeVisible();
});

test("toggles game sound", async ({ page }) => {
  await page.getByRole("button", { name: "Enable game sounds" }).click();
  await expect(page.getByRole("button", { name: "Mute game sounds" })).toBeVisible();
  await page.waitForTimeout(600); // three game ticks
  await expect(page.getByRole("button", { name: "Mute game sounds" })).toBeVisible();
});

test("dismisses a notice", async ({ page }) => {
  await page.getByRole("button", { name: "Open village guide" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  const toast = page.getByRole("status").filter({ hasText: "Village restored from your save." });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss message" }).click();
  await expect(toast).toHaveCount(0);
});

test("the campaign fits a 390px phone width without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
```

- [ ] **Step 3: Run them against the unchanged code**

Run: `npm run build && npx playwright test tests/e2e/campaign.spec.ts`
Expected: 8 passed. These are characterization tests: they must pass on the code as it is today. If one fails, the test is wrong about the current markup; fix the test, not the component, after reading the failing locator against the markup in `game.tsx`.

- [ ] **Step 4: Commit, PR**

```bash
git checkout -b ui/campaign-characterization
git add tests/e2e/campaign.spec.ts tests/e2e/fixtures/village-save.json
git commit -m "test: pin campaign behaviour before the component split"
git push -u origin ui/campaign-characterization
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Eight Playwright tests that pin the campaign's behaviour (build and place, selection panel, guide, save import, research from the URL, sound toggle, notice dismissal, 390px width) before the split in later PRs. No product code.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 3: `useCampaign` hook

**Files:**
- Create: `components/game/use-campaign.ts`
- Modify: `components/game/game.tsx` (the `CampaignGame` function)

**Interfaces:**
- Consumes: `CampaignSession` (`lib/game/campaign-session.ts`), `advanceGame`, `command` (`lib/game/economy.ts`), `crewCommand` (`lib/game/crew.ts`).
- Produces:

```ts
export type Campaign = {
  game: Game;
  /** Applies fn to the latest game, saves, returns false (and sets a notice) when the command throws. */
  update: (fn: (g: Game) => Game) => boolean;
  /** update(command(g, c)); on success plays the chime and shows message. */
  act: (c: Command, message?: string) => boolean;
  /** update(crewCommand(g, c)); UI side effects stay with the caller. */
  crewAct: (c: CrewCommand) => boolean;
  /** The game as of the last update or tick, for handlers that must not read stale render state. */
  latest: () => Game;
  notice: string;
  setNotice: (text: string) => void;
  saved: string;
  sound: boolean;
  setSound: (on: boolean) => void;
  chime: () => void;
};
export function useCampaign(session: CampaignSession, initialGame: Game): Campaign;
```

- [ ] **Step 1: Confirm the guard tests are green on main**

Run: `npx playwright test tests/e2e/campaign.spec.ts tests/e2e/village.spec.ts tests/e2e/session.spec.ts tests/e2e/visual.spec.ts`
Expected: all pass (8 + 2 + 1 + 3). This is the RED/GREEN pair for a refactor: the same command must pass again at Step 4 with the hook in place.

- [ ] **Step 2: Write the hook**

```ts
// components/game/use-campaign.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignSession } from "@/lib/game/campaign-session";
import { advanceGame, command } from "@/lib/game/economy";
import { crewCommand } from "@/lib/game/crew";
import type { CrewCommand } from "@/lib/game/crew-types";
import type { Command, Game } from "@/lib/game/model";

export type Campaign = {
  game: Game;
  update: (fn: (g: Game) => Game) => boolean;
  act: (c: Command, message?: string) => boolean;
  crewAct: (c: CrewCommand) => boolean;
  latest: () => Game;
  notice: string;
  setNotice: (text: string) => void;
  saved: string;
  sound: boolean;
  setSound: (on: boolean) => void;
  chime: () => void;
};

const SAVED = "Saved on this device";
const SAVE_FAILED = "Cannot save on this device · export your village";

/** Owns the campaign's game state, its 200 ms clock, autosave and the command path. */
export function useCampaign(session: CampaignSession, initialGame: Game): Campaign {
  const [game, setGame] = useState<Game>(initialGame);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(SAVED);
  const [sound, setSound] = useState(false);
  const current = useRef(game);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    let stopped = false;
    const save = () => {
      if (!session.active) return;
      try {
        session.save(current.current);
        setSaved(SAVED);
      } catch {
        setSaved(SAVE_FAILED);
      }
    };
    const advance = setInterval(() => {
      if (stopped || !session.active) return;
      const next = advanceGame(current.current, 0.2);
      current.current = next;
      setGame(next);
    }, 200);
    const autosave = setInterval(save, 2000);
    const hide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", hide);
    const shutdown = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(advance);
      clearInterval(autosave);
      document.removeEventListener("visibilitychange", hide);
      save();
    };
    const unregister = session.registerShutdown(shutdown);
    return () => {
      shutdown();
      unregister();
    };
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const chime = useCallback(() => {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current;
      void ctx.resume();
      [523, 659, 784].forEach((frequency, i) => {
        const o = ctx.createOscillator(),
          v = ctx.createGain();
        o.type = "sine";
        o.frequency.value = frequency;
        v.gain.setValueAtTime(0.045, ctx.currentTime + i * 0.06);
        v.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2 + i * 0.06);
        o.connect(v);
        v.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.06);
        o.stop(ctx.currentTime + 0.25 + i * 0.06);
      });
    } catch {}
  }, [sound]);

  const update = useCallback(
    (fn: (g: Game) => Game) => {
      if (!session.active) return false;
      try {
        const next = fn(current.current);
        current.current = next;
        setGame(next);
        // Browsers may terminate a tab without pagehide. Persist player actions
        // before returning, rather than relying on the next autosave or close.
        try {
          session.save(next);
          setSaved(SAVED);
        } catch {
          setSaved(SAVE_FAILED);
        }
        return true;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "That action is unavailable.");
        return false;
      }
    },
    [session],
  );

  const act = useCallback(
    (c: Command, message?: string) => {
      if (!update((g) => command(g, c))) return false;
      chime();
      if (message) setNotice(message);
      return true;
    },
    [update, chime],
  );

  const crewAct = useCallback((c: CrewCommand) => update((g) => crewCommand(g, c)), [update]);
  const latest = useCallback(() => current.current, []);

  return { game, update, act, crewAct, latest, notice, setNotice, saved, sound, setSound, chime };
}
```

- [ ] **Step 3: Use it in `CampaignGame`**

In `components/game/game.tsx`:

1. Replace the `useState` declarations for `game`, `notice`, `saved`, `sound` and the refs `current`, `audio` with:

```ts
  const { game, update, act, latest, notice, setNotice, saved, sound, setSound, chime } = useCampaign(session, initialGame);
  const crewAct = (c: CrewCommand) => {
    if (campaignCrewAct(c) && c.type === "start") {
      setCouncilOpen(false);
      setSelected(null);
      setPlacing(null);
      setNotice("Objective set. Your residents are choosing their jobs.");
    }
    return true;
  };
```

   where `campaignCrewAct` is the hook's `crewAct` destructured as `crewAct: campaignCrewAct`. Keep the remaining `useState` lines (`selected`, `panel`, `councilOpen`, `crewOpen`, `crewView`, `resident`, `research`, `researchFrame`, `placing`, `troop`, `squad`) and the refs `crewTrigger`, `file`.
2. Delete the tick/autosave `useEffect`, the notice-timer `useEffect`, `function chime`, the `update` `useCallback`, `function act` and `function crewAct` from `CampaignGame`.
3. Replace every `current.current` in `CampaignGame` with `latest()` (two places: `openResearch`'s battle check and its `councilResearchRun(latest().council ?? newCouncil())`).
4. Add `import { useCampaign } from "./use-campaign";` and remove the now-unused imports `advanceGame`, `command`, `crewCommand` from `game.tsx` (keep `restoreGame` and `crewRoster`). Remove `useCallback` only if no caller remains; `openResearch` and `researchSection` still use it, so keep it.

- [ ] **Step 4: Lint, typecheck, browser suite**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test`
Expected: lint and typecheck clean; every Playwright test passes, including the three screenshot baselines unchanged.

- [ ] **Step 5: Verify the reports and commit, PR**

Run: `npm test 2>&1 | tail -4 && npm run evaluate -- --verify docs/evaluation-results.json | tail -1 && npm run eval:agent -- --verify public/examples/agent-report.json | tail -1 && git diff --stat -M main -- '*.css'`
Expected: `ℹ fail 0`; `Verified 120 cases`; `Verified 40 cases`; no CSS output.

```bash
git checkout -b ui/use-campaign
git add components/game/use-campaign.ts components/game/game.tsx
git commit -m "refactor(campaign): move game state, clock, autosave and commands into useCampaign"
git push -u origin ui/use-campaign
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "First extraction of the campaign split: the game ref, 200 ms advance loop, 2 s autosave, shutdown save, update/act/crewAct, notice timer, saved message, sound flag and chime move to components/game/use-campaign.ts. CampaignGame keeps the UI state. Behaviour pinned by tests/e2e/campaign.spec.ts; screenshot baselines unchanged.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 4: `SessionGate`

**Files:**
- Create: `components/game/session-gate.tsx`
- Modify: `components/game/game.tsx` (the `SettlementGame` function)

**Interfaces:**
- Consumes: `CampaignSession`, `CampaignSessionState` (`lib/game/campaign-session.ts`).
- Produces:

```ts
export function SessionGate(props: {
  state: CampaignSessionState | "checking";
  session: CampaignSession | null;
  onRetry: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Confirm the guard test is green**

Run: `npx playwright test tests/e2e/session.spec.ts`
Expected: 1 passed.

- [ ] **Step 2: Write the component**

```tsx
// components/game/session-gate.tsx
"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import type { CampaignSession, CampaignSessionState } from "@/lib/game/campaign-session";

const copy: Record<string, { title: string; description: string }> = {
  blocked: {
    title: "Your village is open in another tab",
    description: "Close the other Settlement tab, then retry here. Your progress will load from its latest save.",
  },
  unsupported: {
    title: "This browser cannot safely save your village",
    description:
      "Use a current browser with Web Locks support, and open Settlement through localhost or HTTPS. Your saved village has not been changed.",
  },
  recovery: {
    title: "Your saved village needs attention",
    description:
      "The saved village could not be loaded. Its original data is preserved. Export a backup before choosing to replace it.",
  },
  unavailable: {
    title: "Your village save is unavailable",
    description:
      "Browser access to campaign storage or its save lock failed. Allow site storage, then retry. Your saved village has not been changed.",
  },
  checking: {
    title: "Opening your village",
    description: "Checking that your campaign can save safely on this device.",
  },
};

/** The screen shown while the campaign cannot run: lock held elsewhere, no Web Locks, damaged or unreadable save. */
export function SessionGate({
  state,
  session,
  onRetry,
}: {
  state: CampaignSessionState | "checking";
  session: CampaignSession | null;
  onRetry: () => void;
}) {
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const { title, description } = copy[state] ?? copy.checking;
  function exportOriginal() {
    if (session?.rawSave == null) return;
    const url = URL.createObjectURL(new Blob([session.rawSave], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Settlement-original-save.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="campaign-session">
      <section className="campaign-session-card" aria-labelledby="session-title">
        <p className="campaign-session-brand">SETTLEMENT · YOUR CAMPAIGN</p>
        <Lock size={30} aria-hidden="true" />
        <h1 id="session-title">{title}</h1>
        <p role="status">{description}</p>
        <div className="campaign-session-actions">
          {(state === "blocked" || state === "unavailable") && (
            <button onClick={onRetry}>{state === "blocked" ? "Retry after closing other tab" : "Retry"}</button>
          )}
          {session?.rawSave != null && state !== "blocked" && <button onClick={exportOriginal}>Export original save</button>}
          {state === "recovery" && !confirmReplacement && (
            <button onClick={() => setConfirmReplacement(true)}>Start a new village</button>
          )}
        </div>
        {state === "recovery" && confirmReplacement && (
          <div className="campaign-session-confirm" role="alert">
            <p>Replace this device’s saved village? Keep the exported backup if you want to recover it later.</p>
            <div className="campaign-session-actions">
              <button
                onClick={() => {
                  try {
                    session?.replaceDamagedSave();
                  } catch {
                    setRecoveryError("The new village could not be saved. Your original save is still preserved.");
                  }
                }}
              >
                Replace saved village
              </button>
              <button onClick={() => setConfirmReplacement(false)}>Keep original save</button>
            </div>
          </div>
        )}
        {recoveryError && <p role="alert">{recoveryError}</p>}
      </section>
    </main>
  );
}
```

The JSX and strings are the current ones from `SettlementGame`, moved unchanged; only the `view?.session` reads become `session` props and the retry `setAttempt` becomes `onRetry`.

- [ ] **Step 3: Shrink `SettlementGame`**

In `game.tsx`, `SettlementGame` keeps its `attempt`/`view` state and the session effect, deletes `confirmReplacement`, `recoveryError`, `title`, `description`, `exportOriginal` and the card JSX, and ends with:

```tsx
  if (view?.state === "active" && view.session.active && view.session.game) {
    return <CampaignGame key={view.attempt} session={view.session} initialGame={view.session.game} />;
  }
  return (
    <SessionGate
      state={view?.state ?? "checking"}
      session={view?.session ?? null}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
```

Add `import { SessionGate } from "./session-gate";` and drop `Lock` from the lucide import if nothing else in `game.tsx` uses it (the raid list's locked button does: keep `Lock` until Task 6 moves the dialogs, then drop it there).

- [ ] **Step 4: Verify and ship**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: clean, all browser tests pass, `ℹ fail 0`, no CSS output.

```bash
git checkout -b ui/session-gate
git add components/game/session-gate.tsx components/game/game.tsx
git commit -m "refactor(campaign): extract SessionGate"
git push -u origin ui/session-gate
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Moves the blocked / unsupported / recovery / unavailable card out of SettlementGame into components/game/session-gate.tsx. Strings and markup unchanged; tests/e2e/session.spec.ts covers the blocked-tab flow.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 5: Campaign view model

**Files:**
- Create: `components/game/campaign-view-model.ts`
- Create: `tests/campaign-view-model.test.mjs`
- Modify: `components/game/game.tsx` (use the functions)

**Interfaces:**
- Consumes: `Game`, `Battle`, `Building`, `Resource` (`lib/game/model.ts`), `buildings`, `freeBuilders`, `troops` (`lib/game/catalog.ts`), `crewRoster` (`lib/game/crew.ts`), `councilRun`, `newCouncil` (`lib/game/council.ts`), `Run`, `Agent` (`lib/sim/types.ts`), `ResearchFrame` (`components/observatory.tsx`).
- Produces (all pure, no React):

```ts
export type HudResource = { key: Resource; label: "Gold" | "Timber" | "Food"; amount: number; display: string };
export function hudFigures(game: Game): { hallLevel: number | undefined; builders: string; resources: HudResource[] };
export function armyTotal(game: Game): number;
export function battleStars(battle: Battle): number;
export function destructionPercent(battle: Battle): number;
export function researchCaption(mode: ResearchFrame["mode"] | undefined): "Worker experiment" | "Browser experiment" | "Recorded replay";
export function displayedResearch(frame: ResearchFrame | null, research: { run: Run } | null, game: Game): { run: Run; tick: number };
export function sceneResidents(run: Run, tick: number, game: Game, crewVisible: boolean): Agent[];
export function activeIncidentTargets(run: Run, tick: number): string[];
export function buildingSummary(game: Game, building: Building): string;
export function placementTitle(game: Game, placing: string): string;
```

- [ ] **Step 1: Write the failing tests**

```js
// tests/campaign-view-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../lib/game/economy.ts";
import { councilRun, newCouncil } from "../lib/game/council.ts";
import {
  activeIncidentTargets,
  armyTotal,
  battleStars,
  buildingSummary,
  destructionPercent,
  displayedResearch,
  hudFigures,
  placementTitle,
  researchCaption,
  sceneResidents,
} from "../components/game/campaign-view-model.ts";

const game = newGame();

test("hudFigures reads the hall level, free builders and formatted resources", () => {
  const hud = hudFigures(game);
  assert.equal(hud.hallLevel, 1);
  assert.equal(hud.builders, "2/2");
  assert.deepEqual(
    hud.resources.map((r) => [r.key, r.label, r.amount, r.display]),
    [["gold", "Gold", 1250, "1,250"], ["wood", "Timber", 900, "900"], ["food", "Food", 750, "750"]],
  );
  assert.equal(armyTotal(game), 20);
});

test("battleStars and destructionPercent follow the three-star rule", () => {
  const hall = { id: "h", kind: "hall", x: 0, y: 0, hp: 0, maxHp: 10 };
  const tower = (hp) => ({ id: "t" + hp, kind: "tower", x: 1, y: 1, hp, maxHp: 10 });
  const battle = (buildings) => ({ level: 0, elapsed: 0, units: [], buildings, deployed: 0 });
  assert.equal(battleStars(battle([hall, tower(10), tower(10)])), 1); // hall down, 1/3 destroyed
  assert.equal(battleStars(battle([hall, tower(0), tower(10)])), 2); // hall down, 2/3 destroyed
  assert.equal(battleStars(battle([hall, tower(0), tower(0)])), 3);
  assert.equal(battleStars(battle([{ ...hall, hp: 5 }, tower(0), tower(10)])), 0); // 1/3 destroyed, hall standing
  assert.equal(destructionPercent(battle([hall, tower(0), tower(10)])), 66);
});

test("researchCaption names the three modes and defaults to the recorded replay", () => {
  assert.equal(researchCaption("worker"), "Worker experiment");
  assert.equal(researchCaption("local"), "Browser experiment");
  assert.equal(researchCaption("recorded"), "Recorded replay");
  assert.equal(researchCaption(undefined), "Recorded replay");
});

test("displayedResearch prefers the frame, then the research run, then the council run at its last tick", () => {
  const council = councilRun(game.council ?? newCouncil());
  const fallback = displayedResearch(null, null, game);
  assert.equal(fallback.run.id, council.id);
  assert.equal(fallback.tick, council.snapshots.length - 1);
  const research = displayedResearch(null, { run: council }, game);
  assert.equal(research.tick, council.snapshots.length - 1);
  const framed = displayedResearch({ run: council, tick: 0, selected: "mira", mode: "local" }, { run: council }, game);
  assert.equal(framed.tick, 0);
});

test("sceneResidents overlays crew roles only when the crew is visible and has an objective", () => {
  const run = councilRun(newCouncil());
  const tick = run.snapshots.length - 1;
  const plain = sceneResidents(run, tick, game, true);
  assert.deepEqual(plain, run.snapshots[tick].agents, "no objective: residents unchanged");
  assert.deepEqual(activeIncidentTargets(run, tick), run.incidents.filter((i) => i.tick <= tick && (i.resolvedTick === null || i.resolvedTick > tick)).map((i) => i.target));
});

test("buildingSummary and placementTitle produce the panel strings", () => {
  const hall = game.buildings.find((b) => b.kind === "hall");
  assert.equal(buildingSummary(game, hall), "The heart of Willowmere. Upgrade to unlock stronger buildings.");
  const mine = game.buildings.find((b) => b.kind === "mine");
  assert.match(buildingSummary(game, mine), /gold \/ second · \d+ \/ \d+ stored$/);
  assert.match(buildingSummary(game, { ...mine, readyAt: game.clock + 12 }), /^Ready in 12 seconds$/);
  assert.equal(placementTitle(game, "new:tower"), "Place your watchtower");
  assert.equal(placementTitle(game, hall.id), "Choose a new location");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --experimental-strip-types --test tests/campaign-view-model.test.mjs`
Expected: FAIL, `Cannot find module` for `campaign-view-model.ts`.

- [ ] **Step 3: Write the module**

```ts
// components/game/campaign-view-model.ts
// Pure functions behind the campaign regions. No React, no DOM: tested under node --test.
import { buildings, freeBuilders } from "@/lib/game/catalog";
import { councilRun, newCouncil } from "@/lib/game/council";
import { crewRoster } from "@/lib/game/crew";
import type { Battle, Building, BuildingKind, Game, Resource } from "@/lib/game/model";
import type { Agent, Run } from "@/lib/sim/types";
import type { ResearchFrame } from "../observatory";

export type HudResource = { key: Resource; label: "Gold" | "Timber" | "Food"; amount: number; display: string };

const labels: Record<Resource, HudResource["label"]> = { gold: "Gold", wood: "Timber", food: "Food" };

export function hudFigures(game: Game) {
  return {
    hallLevel: game.buildings.find((b) => b.kind === "hall")?.level,
    builders: `${freeBuilders(game)}/2`,
    resources: (["gold", "wood", "food"] as const).map((key) => {
      const amount = Math.floor(game.resources[key]);
      return { key, label: labels[key], amount, display: amount.toLocaleString("en-US") };
    }),
  };
}

export function armyTotal(game: Game): number {
  return Object.values(game.army).reduce((a, b) => a + b, 0);
}

export function battleStars(battle: Battle): number {
  const destroyed = battle.buildings.filter((b) => b.hp <= 0).length;
  return (
    Number(battle.buildings.find((b) => b.kind === "hall")!.hp <= 0) +
    Number(destroyed / battle.buildings.length >= 0.5) +
    Number(battle.buildings.every((b) => b.hp <= 0))
  );
}

export function destructionPercent(battle: Battle): number {
  return Math.floor((battle.buildings.filter((b) => b.hp <= 0).length / battle.buildings.length) * 100);
}

export function researchCaption(mode: ResearchFrame["mode"] | undefined) {
  return mode === "worker" ? "Worker experiment" : mode === "local" ? "Browser experiment" : "Recorded replay";
}

export function displayedResearch(frame: ResearchFrame | null, research: { run: Run } | null, game: Game): { run: Run; tick: number } {
  const run = frame?.run ?? research?.run ?? councilRun(game.council ?? newCouncil());
  return { run, tick: frame?.tick ?? run.snapshots.length - 1 };
}

/** Residents for the map; crew roles and colours overlay the social agents while the crew works. */
export function sceneResidents(run: Run, tick: number, game: Game, crewVisible: boolean): Agent[] {
  const overlay = crewVisible && game.crew?.objective;
  return run.snapshots[tick].agents.map((a) => {
    const crewPerson = overlay ? crewRoster.find((r) => r.id === a.id) : null;
    return crewPerson ? { ...a, occupation: crewPerson.role, color: crewPerson.color } : a;
  });
}

export function activeIncidentTargets(run: Run, tick: number): string[] {
  return run.incidents.filter((i) => i.tick <= tick && (i.resolvedTick === null || i.resolvedTick > tick)).map((i) => i.target);
}

export function buildingSummary(game: Game, building: Building): string {
  const def = buildings[building.kind];
  if (building.readyAt) return `Ready in ${Math.ceil(building.readyAt - game.clock)} seconds`;
  if (def.resource)
    return `${def.rate * building.level} ${def.resource} / second · ${Math.floor(building.stored)} / ${def.capacity * building.level} stored`;
  return def.description;
}

export function placementTitle(game: Game, placing: string): string {
  return game.buildings.some((b) => b.id === placing)
    ? "Choose a new location"
    : `Place your ${buildings[placing.slice(4) as BuildingKind].name.toLowerCase()}`;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --experimental-strip-types --test tests/campaign-view-model.test.mjs`
Expected: PASS, 6 tests. If `sceneResidents` fails because `newGame()` already has a crew objective, change the test to pass `false` for `crewVisible` and keep the assertion.

- [ ] **Step 5: Use the module in `game.tsx`**

Replace, inside `CampaignGame`:
- the `stars` expression with `const stars = battle ? battleStars(battle) : 0;`
- the `displayedRun`/`displayedTick` pair with `const displayed = displayedResearch(researchFrame, research, game);` and then `displayed.run` / `displayed.tick` where they were used;
- the `residents={...}` prop with `residents={sceneResidents(displayed.run, displayed.tick, game, !research && !councilOpen)}`;
- the `activeIncidents={...}` prop with `activeIncidents={activeIncidentTargets(displayed.run, displayed.tick)}`;
- the caption ternary with `{researchCaption(researchFrame?.mode)}`;
- the `% destroyed` expression with `{destructionPercent(battle)}`;
- the building panel `<p>` content with `{buildingSummary(game, building)}`;
- the placement notice `<b>` content with `{placementTitle(game, placing)}`;
- the HUD: `<b>{hud.hallLevel}</b>`, `<b>{hud.builders}</b>` and the resources map over `hud.resources` using `r.key`, `r.amount` for the `aria-label` (`${r.key}: ${r.amount}`), `r.display` and `r.label`, with `const hud = hudFigures(game);` above the return;
- the army dock total with `{armyTotal(game)}/40`.

Add the import of these functions from `./campaign-view-model` and remove `councilRun`, `newCouncil`, `crewRoster` from `game.tsx` imports if nothing else uses them (`openResearch` still uses `councilResearchRun` and `newCouncil`: keep `newCouncil`).

- [ ] **Step 6: Verify and ship**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: clean, all browser tests pass including the baselines, `ℹ fail 0`, no CSS output.

```bash
git checkout -b ui/campaign-view-model
git add components/game/campaign-view-model.ts tests/campaign-view-model.test.mjs components/game/game.tsx
git commit -m "refactor(campaign): pure view-model functions with unit tests"
git push -u origin ui/campaign-view-model
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "HUD figures, battle stars, research caption and displayed run, scene residents, building summary and placement title leave CampaignGame as pure functions in components/game/campaign-view-model.ts with six node tests. Rendering unchanged; baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 6: `CampaignDialogs` and `Guide`

**Files:**
- Create: `components/game/campaign-dialogs.tsx`
- Create: `components/game/guide.tsx`
- Modify: `components/game/game.tsx`

**Interfaces:**
- Consumes: `Campaign.act`, `Campaign.update` (Task 3); `Cost` and `download` helpers, which move from `game.tsx` to `campaign-dialogs.tsx` and are exported from there.
- Produces:

```ts
export type Panel = "build" | "train" | "raid" | "guide";
export function Cost(props: { cost: Partial<Resources> }): JSX.Element;
export function download(g: Game): void;
export function CampaignDialogs(props: {
  panel: Panel | null;
  game: Game;
  act: (c: Command, message?: string) => boolean;
  update: (fn: (g: Game) => Game) => boolean;
  onClose: () => void;                 // setPanel(null)
  onPlace: (kind: BuildingKind) => void; // composer: setPlacing(`new:${kind}`); setPanel(null); setSelected(null)
  onScouted: () => void;               // composer: setPanel(null); setSelected(null) after a successful startBattle
  guide: GuideProps;
}): JSX.Element | null;
// guide.tsx
export type GuideProps = {
  game: Game;
  onImport: (imported: Game) => void;  // composer: update(() => imported) then reset every panel and notice "Village restored from your save."
  onError: (message: string) => void;  // composer: setNotice(message)
  onResearch: () => void;              // composer: openResearch()
};
export function Guide(props: GuideProps): JSX.Element;
```

- [ ] **Step 1: Confirm the guard tests are green**

Run: `npx playwright test tests/e2e/campaign.spec.ts`
Expected: 8 passed.

- [ ] **Step 2: Write `guide.tsx`**

```tsx
// components/game/guide.tsx
"use client";
import { useRef } from "react";
import { BookOpen, Download, Hammer, Shield, Swords } from "lucide-react";
import { restoreGame } from "@/lib/game/economy";
import type { Game } from "@/lib/game/model";
import { download } from "./campaign-dialogs";

export type GuideProps = {
  game: Game;
  onImport: (imported: Game) => void;
  onError: (message: string) => void;
  onResearch: () => void;
};

/** The player guide: how to play, plus export, import and the research shortcut. */
export function Guide({ game, onImport, onError, onResearch }: GuideProps) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="game-guide">
      {/* the five <div> blocks, the .guide-limit paragraph and the .guide-links block move here unchanged from game.tsx,
          with onClick={() => download(game)}, onClick={() => file.current?.click()} and onClick={onResearch} */}
      <input
        type="file"
        ref={file}
        hidden
        accept="application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 2000000) throw Error("Choose a save smaller than 2 MB.");
            onImport(restoreGame(await f.text()));
          } catch (error) {
            onError(error instanceof Error ? error.message : "Cannot read save.");
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
```

Move the guide JSX (`<div className="guide-vista" …/>` through `</div>` of `.guide-links`) from `game.tsx` into the comment's place, byte for byte except the three `onClick` handlers named above. The import handler no longer calls `update` or resets panels itself: the composer does that in `onImport`.

- [ ] **Step 3: Write `campaign-dialogs.tsx`**

```tsx
// components/game/campaign-dialogs.tsx
"use client";
import { ChevronRight, Clock, Coins, Hammer, Lock, Shield, Swords, TreePine, Wheat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { actionProblem, buildProblem } from "@/lib/game/action-availability";
import { startBattle } from "@/lib/game/battle";
import { armySize, buildings, freeBuilders, opponents, troops } from "@/lib/game/catalog";
import type { BuildingKind, Command, Game, Resources, TroopKind } from "@/lib/game/model";
import { Sprite } from "./scene";
import { Guide, type GuideProps } from "./guide";

export type Panel = "build" | "train" | "raid" | "guide";

const resourceIcons = { gold: Coins, wood: TreePine, food: Wheat };

export function Cost({ cost }: { cost: Partial<Resources> }) {
  /* moved unchanged from game.tsx */
}

export function download(g: Game) {
  /* moved unchanged from game.tsx */
}

const titles: Record<Panel, string> = {
  build: "Make room for possibility.",
  train: "Your army starts here.",
  raid: "Beyond the treeline.",
  guide: "Welcome home, chief.",
};

/** The build, train, raid and guide dialog. Rendered only while a panel is open. */
export function CampaignDialogs({
  panel,
  game,
  act,
  update,
  onClose,
  onPlace,
  onScouted,
  guide,
}: {
  panel: Panel | null;
  game: Game;
  act: (c: Command, message?: string) => boolean;
  update: (fn: (g: Game) => Game) => boolean;
  onClose: () => void;
  onPlace: (kind: BuildingKind) => void;
  onScouted: () => void;
  guide: GuideProps;
}) {
  if (panel === null) return null;
  const description =
    panel === "build"
      ? `${freeBuilders(game)} of 2 builders available. Choose a building, then place it in your village.`
      : panel === "train"
        ? `${armySize(game)} / 40 camp spaces used. Training continues while you explore.`
        : panel === "raid"
          ? "Scout a stronghold, deploy your troops, and bring the spoils home."
          : "Build a thriving village and lead your troops into battle.";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="game-dialog">
        <DialogTitle className="game-dialog-title">{titles[panel]}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {panel === "build" ? (
          <div className="build-shop">{/* moved unchanged; the shop-item onClick becomes onClick={() => onPlace(k)} */}</div>
        ) : null}
        {panel === "train" ? <>{/* .training-shop and .training-queue moved unchanged; they call act(...) */}</> : null}
        {panel === "raid" ? (
          <div className="raid-list">{/* moved unchanged; the scout onClick becomes: if (update((g) => startBattle(g, i))) onScouted(); */}</div>
        ) : null}
        {panel === "guide" ? <Guide {...guide} /> : null}
      </DialogContent>
    </Dialog>
  );
}
```

Fill each comment with the matching JSX block from `game.tsx`, moved unchanged apart from the two handler substitutions named in the comments. The title ternary becomes the `titles` lookup, which renders the same strings.

- [ ] **Step 4: Use them in the composer**

In `game.tsx`: delete `Cost`, `download`, `resourceIcons` (the HUD still needs `resourceIcons`: keep a local copy of the three-icon object in `game.tsx` until Task 7 moves the HUD; name it `resourceIcons` as today) and the whole `{panel !== null ? (<Dialog …>) : null}` block; replace it with:

```tsx
      <CampaignDialogs
        panel={panel}
        game={game}
        act={act}
        update={update}
        onClose={() => setPanel(null)}
        onPlace={(kind) => {
          setPlacing(`new:${kind}`);
          setPanel(null);
          setSelected(null);
        }}
        onScouted={() => {
          setPanel(null);
          setSelected(null);
        }}
        guide={{
          game,
          onResearch: () => openResearch(),
          onError: setNotice,
          onImport: (imported) => {
            if (!update(() => imported)) return;
            closeResearch();
            setCouncilOpen(false);
            setCrewOpen(false);
            setSelected(null);
            setPlacing(null);
            setPanel(null);
            setNotice("Village restored from your save.");
          },
        }}
      />
```

Import `CampaignDialogs`, `Cost`, `download`, type `Panel` from `./campaign-dialogs`; change the `panel` state type to `Panel | null`; delete the `file` ref and the imports `game.tsx` no longer uses (`Dialog*` stay for the results dialog until Task 8; `restoreGame`, `startBattle`, `armySize`, `opponents`, `buildProblem`, `Lock`, `BookOpen` only if unused: check with `npm run lint`, which reports unused imports).

- [ ] **Step 5: Verify and ship**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/game/campaign-dialogs.tsx components/game/guide.tsx`
Expected: clean; all browser tests pass (the import test proves the reset path survived the move); `ℹ fail 0`; no CSS output; dialogs ≤ 300 lines, guide ≤ 200.

```bash
git checkout -b ui/campaign-dialogs
git add components/game/campaign-dialogs.tsx components/game/guide.tsx components/game/game.tsx
git commit -m "refactor(campaign): extract CampaignDialogs and Guide"
git push -u origin ui/campaign-dialogs
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The build / train / raid / guide dialog moves to components/game/campaign-dialogs.tsx, the guide content and save import to guide.tsx. The composer owns the import's state reset through onImport. Markup unchanged; tests/e2e/campaign.spec.ts and the baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 7: `CampaignHud` and `CampaignFooter`

**Files:**
- Create: `components/game/campaign-hud.tsx`
- Create: `components/game/campaign-footer.tsx`
- Modify: `components/game/game.tsx`

**Interfaces:**
- Consumes: `hudFigures`, `armyTotal` (Task 5), `Cost` (Task 6), `Panel` (Task 6), `Campaign.act`, `Campaign.crewAct` wrapper from the composer.
- Produces:

```ts
export function CampaignHud(props: {
  game: Game;
  raiding: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
  onGuide: () => void;
  researchSection: string | null;   // research?.section ?? null
  councilOpen: boolean;
  onVillage: () => void;            // closeResearch(); setCouncilOpen(false)
  onCouncil: () => void;            // openCouncil()
  onResearch: (section?: string) => void; // openResearch(section)
}): JSX.Element;
export function CampaignFooter(props: {
  game: Game;
  act: (c: Command, message?: string) => boolean;
  crewAct: (c: CrewCommand) => boolean;
  onInspect: (id?: string) => void; // openCrew
  onCouncil: () => void;
  onPanel: (panel: Panel) => void;  // setPanel(p); for "build" and "raid" the footer also calls onSelect(null)
  onSelect: (id: string | null) => void;
  onNotice: (text: string) => void;
}): JSX.Element;
```

- [ ] **Step 1: Confirm the guard tests are green**

Run: `npx playwright test tests/e2e/campaign.spec.ts tests/e2e/village.spec.ts tests/e2e/visual.spec.ts`
Expected: 13 passed.

- [ ] **Step 2: Write `campaign-hud.tsx`**

```tsx
// components/game/campaign-hud.tsx
"use client";
import { BookOpen, Clock, Coins, Hammer, Home, Shield, TreePine, Volume2, VolumeX, Wheat } from "lucide-react";
import type { Game } from "@/lib/game/model";
import { hudFigures } from "./campaign-view-model";

const resourceIcons = { gold: Coins, wood: TreePine, food: Wheat };

/** The top bar: banner, builders, resources, sound; and the settlement navigation while not raiding. */
export function CampaignHud({ game, raiding, sound, onSound, onGuide, researchSection, councilOpen, onVillage, onCouncil, onResearch }: {
  game: Game;
  raiding: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
  onGuide: () => void;
  researchSection: string | null;
  councilOpen: boolean;
  onVillage: () => void;
  onCouncil: () => void;
  onResearch: (section?: string) => void;
}) {
  const hud = hudFigures(game);
  const research = researchSection !== null;
  return (
    <>
      <header className="game-hud">{/* moved unchanged from game.tsx: onClick={onGuide}; hud.hallLevel; hud.builders; the resources map over hud.resources; onClick={() => onSound(!sound)} */}</header>
      {!raiding && (
        <nav className="settlement-navigation" aria-label="Settlement navigation">
          {/* moved unchanged: aria-pressed={!research && !councilOpen} onClick={onVillage}; aria-pressed={councilOpen} onClick={onCouncil};
              aria-pressed={research && researchSection !== "library"} onClick={() => onResearch()}; aria-pressed={researchSection === "library"} onClick={() => onResearch("library")} */}
        </nav>
      )}
    </>
  );
}
```

Fill the comments with the `<header className="game-hud">…</header>` and `<nav …>…</nav>` blocks from `game.tsx`, substituting only the handlers and flags named in the comments.

- [ ] **Step 3: Write `campaign-footer.tsx`**

```tsx
// components/game/campaign-footer.tsx
"use client";
import { ChevronRight, Hammer, Shield, Swords, Trophy } from "lucide-react";
import { quests, troops } from "@/lib/game/catalog";
import type { Command, Game, TroopKind } from "@/lib/game/model";
import type { CrewCommand } from "@/lib/game/crew-types";
import { Sprite } from "./scene";
import { CrewBoard } from "./crew";
import { VillageJournal } from "./village-journal";
import { armyTotal } from "./campaign-view-model";
import type { Panel } from "./campaign-dialogs";

/** Everything below the map while the village is at peace: crew board, journal, league badge, army dock and the Build / Battle buttons. */
export function CampaignFooter({ game, act, crewAct, onInspect, onCouncil, onPanel, onSelect, onNotice }: {
  game: Game;
  act: (c: Command, message?: string) => boolean;
  crewAct: (c: CrewCommand) => boolean;
  onInspect: (id?: string) => void;
  onCouncil: () => void;
  onPanel: (panel: Panel) => void;
  onSelect: (id: string | null) => void;
  onNotice: (text: string) => void;
}) {
  function quest(id: string) {
    const q = quests.find((entry) => entry.id === id);
    if (!q) return;
    if (game.stats[q.stat] >= q.goal) act({ type: "claim", id }, `Milestone complete! +${q.reward} gold`);
    else if (id === "build") onPanel("build");
    else if (id === "raid") onPanel("raid");
    else if (id === "upgrade") onSelect("hall");
    else onNotice("Tap the resource bubbles above your mine, mill and farm.");
  }
  return (
    <>
      <CrewBoard game={game} onCommand={crewAct} onInspect={onInspect} onCouncil={onCouncil} onRaid={() => onPanel("raid")} />
      <VillageJournal game={game} onResident={onInspect} onGuide={() => onPanel("guide")} onQuest={quest} />
      <div className="village-badge">{/* moved unchanged */}</div>
      <footer className="game-bottom">
        {/* .army-dock and .village-actions moved unchanged: setPanel("train") → onPanel("train"); the Build button → onPanel("build"); onSelect(null);
            the Battle button → onPanel("raid"); onSelect(null); the army total → {armyTotal(game)}/40 */}
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Use them in the composer**

In `game.tsx` replace the `<header className="game-hud">…</header>` and `{!raiding && (<nav …/>)}` blocks with:

```tsx
      <CampaignHud
        game={game}
        raiding={raiding}
        sound={sound}
        onSound={setSound}
        onGuide={() => setPanel("guide")}
        researchSection={research?.section ?? null}
        councilOpen={councilOpen}
        onVillage={() => {
          closeResearch();
          setCouncilOpen(false);
        }}
        onCouncil={() => openCouncil()}
        onResearch={openResearch}
      />
```

and, inside the `!raiding ? (!research && (<>…</>))` branch, replace `<CrewBoard …/>`, `<VillageJournal …/>`, the `.village-badge` div and the `<footer className="game-bottom">` block with:

```tsx
            <CampaignFooter
              game={game}
              act={act}
              crewAct={crewAct}
              onInspect={openCrew}
              onCouncil={() => openCouncil()}
              onPanel={setPanel}
              onSelect={setSelected}
              onNotice={setNotice}
            />
```

The placement notice and building panel stay in the composer until Task 8. Delete `resourceIcons` and the imports `game.tsx` no longer uses (`CrewBoard`, `VillageJournal`, `quests`, `Trophy`, `Volume2`, `VolumeX`, `Home`, `BookOpen`, `Coins`, `TreePine`, `Wheat`, `hudFigures`, `armyTotal`); `npm run lint` lists any left behind.

- [ ] **Step 5: Verify and ship**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/game/campaign-hud.tsx components/game/campaign-footer.tsx`
Expected: clean; all browser tests pass; `ℹ fail 0`; no CSS output; hud ≤ 200, footer ≤ 150.

```bash
git checkout -b ui/campaign-hud-footer
git add components/game/campaign-hud.tsx components/game/campaign-footer.tsx components/game/game.tsx
git commit -m "refactor(campaign): extract CampaignHud and CampaignFooter"
git push -u origin ui/campaign-hud-footer
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The header, settlement navigation, crew board, journal, league badge, army dock and Build / Battle buttons move out of CampaignGame into campaign-hud.tsx and campaign-footer.tsx. Markup unchanged; tests/e2e and the three baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 8: `SelectionPanel` and `BattleOverlay`

**Files:**
- Create: `components/game/selection-panel.tsx`
- Create: `components/game/battle-overlay.tsx`
- Modify: `components/game/game.tsx`

**Interfaces:**
- Consumes: `buildingSummary`, `placementTitle`, `battleStars`, `destructionPercent` (Task 5); `Cost` (Task 6); `Campaign.act`, `Campaign.update`, `Campaign.chime`.
- Produces:

```ts
export function SelectionPanel(props: {
  game: Game;
  placing: string | null;
  building: Building | undefined;    // game.buildings.find((b) => b.id === selected)
  act: (c: Command, message?: string) => boolean;
  onCancelPlacing: () => void;       // setPlacing(null)
  onClose: () => void;               // setSelected(null)
  onTrain: () => void;               // setPanel("train")
  onMove: (id: string) => void;      // setPlacing(id)
}): JSX.Element | null;
export function BattleOverlay(props: {
  game: Game;
  battle: Battle;
  troop: TroopKind;
  squad: number;
  onTroop: (kind: TroopKind) => void;
  onSquad: (n: number) => void;
  update: (fn: (g: Game) => Game) => boolean;
  onDeployed: () => void;            // chime()
  onReturnHome: () => void;          // update(settleBattle, battle: undefined); setSelected(null); chime()
}): JSX.Element;
```

- [ ] **Step 1: Confirm the guard tests are green**

Run: `npx playwright test tests/e2e/campaign.spec.ts tests/e2e/visual.spec.ts`
Expected: 11 passed.

- [ ] **Step 2: Write `selection-panel.tsx`**

```tsx
// components/game/selection-panel.tsx
"use client";
import { ArrowUp, Hammer, Move, X } from "lucide-react";
import { actionProblem } from "@/lib/game/action-availability";
import { buildings, upgradeCost } from "@/lib/game/catalog";
import type { Building, Command, Game } from "@/lib/game/model";
import { Sprite } from "./scene";
import { Cost } from "./campaign-dialogs";
import { buildingSummary, placementTitle } from "./campaign-view-model";

/** The placement notice while placing, else the panel for the selected building. */
export function SelectionPanel({ game, placing, building, act, onCancelPlacing, onClose, onTrain, onMove }: {
  game: Game;
  placing: string | null;
  building: Building | undefined;
  act: (c: Command, message?: string) => boolean;
  onCancelPlacing: () => void;
  onClose: () => void;
  onTrain: () => void;
  onMove: (id: string) => void;
}) {
  if (placing)
    return (
      <div className="placement-notice">{/* moved unchanged: <b>{placementTitle(game, placing)}</b>; the cancel button onClick={onCancelPlacing} */}</div>
    );
  if (!building) return null;
  const def = buildings[building.kind];
  const upgradeProblem = actionProblem(game, { type: "upgrade", id: building.id });
  return (
    <section className="building-panel">
      {/* moved unchanged: panel-close onClick={onClose}; <p>{buildingSummary(game, building)}</p>; Train troops onClick={onTrain}; move-button onClick={() => onMove(building.id)} */}
    </section>
  );
}
```

Note the current composer renders the panel only when `building && def && !placing`; `def` is always defined for a valid kind, so the `if (placing)` / `if (!building)` order reproduces the same rendering.

- [ ] **Step 3: Write `battle-overlay.tsx`**

```tsx
// components/game/battle-overlay.tsx
"use client";
import { Clock, Flag, Home, Star, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deploy, retreat } from "@/lib/game/battle";
import { opponents, troops } from "@/lib/game/catalog";
import type { Battle, Game, TroopKind } from "@/lib/game/model";
import { Sprite } from "./scene";
import { Cost } from "./campaign-dialogs";
import { battleStars, destructionPercent } from "./campaign-view-model";

/** The raid: banner, hint with deployment shortcuts, controls, and the results dialog once the battle is settled. */
export function BattleOverlay({ game, battle, troop, squad, onTroop, onSquad, update, onDeployed, onReturnHome }: {
  game: Game;
  battle: Battle;
  troop: TroopKind;
  squad: number;
  onTroop: (kind: TroopKind) => void;
  onSquad: (n: number) => void;
  update: (fn: (g: Game) => Game) => boolean;
  onDeployed: () => void;
  onReturnHome: () => void;
}) {
  const stars = battleStars(battle);
  const done = battle.result;
  const deployFrom = (zone: string) => {
    if (update((g) => deploy(g, troop, zone, Math.min(squad, g.army[troop])))) onDeployed();
  };
  return (
    <>
      <div className="battle-banner">{/* moved unchanged; {destructionPercent(battle)}% destroyed */}</div>
      {!done ? (
        <>
          <div className="battle-hint">{/* moved unchanged; shortcut onClick={() => deployFrom(zone)} */}</div>
          <div className="battle-controls">{/* moved unchanged; retreat onClick={() => update(retreat)}; army-card onClick={() => onTroop(k)}; squad onClick={() => onSquad(squad === 1 ? 5 : 1)} */}</div>
        </>
      ) : null}
      {done ? (
        <Dialog open onOpenChange={() => {}}>{/* results dialog moved unchanged; Return to village onClick={onReturnHome} */}</Dialog>
      ) : null}
    </>
  );
}
```

The current deployment shortcuts in the hint call `update(deploy(...))` without a chime while the map's `onDeploy` chimes; `deployFrom` chimes in both places. Record this as a ruling in the ledger (one chime more on the keyboard shortcut, no visual change).

- [ ] **Step 4: Use them in the composer**

In `game.tsx`:
- replace the placement notice and building panel blocks with `<SelectionPanel game={game} placing={placing} building={building} act={act} onCancelPlacing={() => setPlacing(null)} onClose={() => setSelected(null)} onTrain={() => setPanel("train")} onMove={setPlacing} />`;
- replace the whole `: (<> <div className="battle-banner">… </>)` else-branch of `!raiding ? … : …` and the `{done ? (<Dialog …results…>) : null}` block with one `<BattleOverlay game={game} battle={battle} troop={troop} squad={squad} onTroop={setTroop} onSquad={setSquad} update={update} onDeployed={chime} onReturnHome={returnHome} />` rendered when `battle` is set;
- the Scene's `onDeploy` becomes `onDeploy={(zone) => { if (update((g) => deploy(g, troop, zone, Math.min(squad, g.army[troop])))) chime(); }}` (unchanged);
- delete `def`, `upgradeProblem`, `stars`, `done` from the composer, and the imports it no longer uses (`Dialog*`, `Star`, `Trophy`, `Flag`, `Clock`, `Home`, `ArrowUp`, `Move`, `X` if the toast no longer needs it: the toast keeps `X` and `Check`; `retreat`, `opponents`, `upgradeCost`, `actionProblem`, `Cost`, `Sprite` as lint reports).

- [ ] **Step 5: Verify and ship**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css' && wc -l components/game/selection-panel.tsx components/game/battle-overlay.tsx components/game/game.tsx`
Expected: clean; all browser tests pass; `ℹ fail 0`; no CSS output; selection ≤ 250, battle ≤ 250; `game.tsx` now near 400 lines (Task 9 brings it under 300).

```bash
git checkout -b ui/selection-battle
git add components/game/selection-panel.tsx components/game/battle-overlay.tsx components/game/game.tsx
git commit -m "refactor(campaign): extract SelectionPanel and BattleOverlay"
git push -u origin ui/selection-battle
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "The placement notice and building panel move to selection-panel.tsx; the raid banner, hint, controls and results dialog move to battle-overlay.tsx. Markup unchanged; tests/e2e and the three baselines pass.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

### Task 9: `ResearchOverlay`, composer under 300 lines, size test, measurement, docs

**Files:**
- Create: `components/game/research-overlay.tsx`
- Create: `tests/component-size.test.mjs`
- Modify: `components/game/game.tsx`
- Modify: `docs/ui-architecture-verification.md`, `docs/superpowers/specs/2026-10-10-ui-architecture-design.md` (add the `battle-overlay.tsx` row), `README.md` (components section), `CHANGELOG.md` (new "Unreleased" section at the top)

**Interfaces:**
- Consumes: `researchCaption`, `displayedResearch` (Task 5); `ResearchFrame`, `Observatory` (`components/observatory.tsx`).
- Produces:

```ts
export function ResearchOverlay(props: {
  research: { run: Run; section: string };
  frame: ResearchFrame | null;
  displayed: { run: Run; tick: number };
  resident: string;
  onResident: (id: string) => void;
  onSection: (section: string) => void;
  onFrame: (frame: ResearchFrame) => void;
  onExit: () => void;
}): JSX.Element;
// tests/component-size.test.mjs
export function oversize(limits: Record<string, number>, lines: (file: string) => number): string[]; // "file: N lines (limit M)"
```

- [ ] **Step 1: Write the failing size test**

```js
// tests/component-size.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Spec: docs/superpowers/specs/2026-10-10-ui-architecture-design.md, "Target layout". Lines as wc -l counts them.
export const limits = {
  "components/game/game.tsx": 300,
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test tests/component-size.test.mjs`
Expected: FAIL: `ENOENT` for `research-overlay.tsx` (not yet created) or `game.tsx` over 300.

- [ ] **Step 3: Write `research-overlay.tsx`**

```tsx
// components/game/research-overlay.tsx
"use client";
import { lazy, Suspense } from "react";
import type { Run } from "@/lib/sim/types";
import type { ResearchFrame } from "../observatory";
import { researchCaption } from "./campaign-view-model";

const Research = lazy(() => import("../observatory").then((m) => ({ default: m.Observatory })));

/** The research desk over the map: caption for the displayed run and the lazily loaded Observatory. */
export function ResearchOverlay({ research, frame, displayed, resident, onResident, onSection, onFrame, onExit }: {
  research: { run: Run; section: string };
  frame: ResearchFrame | null;
  displayed: { run: Run; tick: number };
  resident: string;
  onResident: (id: string) => void;
  onSection: (section: string) => void;
  onFrame: (frame: ResearchFrame) => void;
  onExit: () => void;
}) {
  return (
    <>
      <div className="research-map-caption">
        <strong>{displayed.run.name}</strong>
        <span>
          Tick {displayed.tick} · {researchCaption(frame?.mode)}
        </span>
        <p>Select a resident on the map to follow their decisions.</p>
      </div>
      <aside className="unified-workbench" aria-label="Village research desk">
        <Suspense fallback={<p className="research-loading">Opening the village records…</p>}>
          <Research
            currentRun={research.run}
            section={research.section}
            onSection={onSection}
            selectedResident={resident}
            onSelected={onResident}
            onFrame={onFrame}
            onExit={onExit}
          />
        </Suspense>
      </aside>
    </>
  );
}
```

The caption's exact text node sequence must match today's (`Tick {displayedTick} ·{" "}{mode text}`): keep the `{" "}` form from `game.tsx` if the baseline screenshot differs by a space.

- [ ] **Step 4: Finish the composer**

In `game.tsx` replace the `{research && (<> <div className="research-map-caption">… <aside …>…</aside> </>)}` block with:

```tsx
      {research && (
        <ResearchOverlay
          research={research}
          frame={researchFrame}
          displayed={displayed}
          resident={resident}
          onResident={setResident}
          onSection={researchSection}
          onFrame={setResearchFrame}
          onExit={closeResearch}
        />
      )}
```

Remove `lazy`, `Suspense` and the `Research` constant from `game.tsx`. Then read `game.tsx` top to bottom once and fold the small handlers (`choose`, `place`, `returnHome`, `openCrew`, `openCouncil`, `closeResearch`) so they stay but any dead variable or import goes. Run `wc -l components/game/game.tsx`: it must be ≤ 300. If it is not, the remaining bulk is the `<Scene …/>` call and the `CrewInspector` / `CouncilPanel` mounts; move the `Scene` prop block into a `sceneProps` object built above the return rather than creating another file.

- [ ] **Step 5: Run the size test and the suites**

Run: `node --experimental-strip-types --test tests/component-size.test.mjs && npm run lint && npm run typecheck && npm run build && npx playwright test && npm test 2>&1 | tail -3 && git diff --stat -M main -- '*.css'`
Expected: size test PASS (2); lint and typecheck clean; all browser tests pass; `ℹ fail 0`; no CSS output.

- [ ] **Step 6: Measure after the split, decide on memo**

Run: `(npm start &) && sleep 5 && npm run measure:ui -- --out /tmp/ui-after-plan1.json; kill %1`
Expected: a two-row table. Paste it under "After Plan 1 (campaign split)" in `docs/ui-architecture-verification.md` with commit, machine, Node and Chromium.

Then try one memo: wrap the export in `components/game/campaign-footer.tsx` as `export const CampaignFooter = memo(function CampaignFooter(...) {...})` (the footer re-renders every tick but its inputs change only when the game object changes, which is every tick too, so a drop is unlikely; the measurement decides). Rebuild, re-measure into `/tmp/ui-after-plan1-memo.json`. If "campaign idle" script ms drops by more than 10% against the un-memoed table on the same machine, keep the memo and add a row under "Memoization decisions" with both numbers; otherwise remove the memo and write "campaign-footer memo tried, no drop (<before> vs <after> ms), removed." under the same heading.

- [ ] **Step 7: Docs**

- `docs/superpowers/specs/2026-10-10-ui-architecture-design.md`: add the row `| battle-overlay.tsx | The raid banner, hint with deployment shortcuts, controls, and the results dialog. | 250 lines |` to the campaign table after `guide.tsx`, and change the campaign `game.tsx` row's "Owns" text to also say "and the `Scene`, `CrewInspector` and `CouncilPanel` mounts".
- `README.md`, in the layout block that currently reads `components/game/     Village, combat, crew inspector and research views`, add two lines below it:

```
components/game/game.tsx            Campaign composer; use-campaign.ts owns state, clock and saves
components/game/campaign-*.tsx      HUD, footer, dialogs, selection, battle and research regions
```

- `CHANGELOG.md`: insert above `## 0.9.0 — 2026-10-10`:

```markdown
## Unreleased

- **Campaign component split.** `components/game/game.tsx` is a 300-line composer; the game clock, autosave and command path live in `use-campaign.ts`, each visible region in its own file, and the pure view logic in `campaign-view-model.ts` with unit tests. Markup, CSS and the screenshot baselines are unchanged. `npm run measure:ui` records Chrome performance metrics on the production build (`docs/ui-architecture-verification.md`).

```

- [ ] **Step 8: Verify, commit, PR**

Run: `npm run lint && npm run typecheck && npm test 2>&1 | tail -3 && npm run evaluate -- --verify docs/evaluation-results.json | tail -1 && npm run eval:agent -- --verify public/examples/agent-report.json | tail -1 && git diff --stat -M main -- '*.css'`
Expected: clean; `ℹ fail 0`; `Verified 120 cases`; `Verified 40 cases`; no CSS output.

```bash
git checkout -b ui/research-overlay-size-test
git add components/game/research-overlay.tsx components/game/game.tsx tests/component-size.test.mjs docs/ui-architecture-verification.md docs/superpowers/specs/2026-10-10-ui-architecture-design.md README.md CHANGELOG.md
git add components/game/campaign-footer.tsx 2>/dev/null
git commit -m "refactor(campaign): extract ResearchOverlay, enforce file size limits, record post-split measurement"
git push -u origin ui/research-overlay-size-test
gh pr create -R Lingikaushikreddy/Settlement-Village --fill --body "Last extraction of the campaign split: the research caption and lazy Observatory mount move to research-overlay.tsx and game.tsx ends under 300 lines. tests/component-size.test.mjs enforces every limit from the spec. docs/ui-architecture-verification.md gains the after-Plan-1 measurement and the memo decision. CHANGELOG Unreleased entry; README layout lines.

CSS diff: none"
```

Wait for CI, squash-merge, `git checkout main && git pull`.

---

## Self-review

- **Spec coverage.** Target layout: Tasks 3–9 create every campaign file in the spec's table plus `battle-overlay.tsx` (Task 9 adds it to the spec). State and data flow: the hook is the only writer of `game` (Task 3); regions get props and memoized callbacks (`update`, `act`, `crewAct`, `latest`, `chime` from the hook). Performance policy: Task 1 script and baseline, Task 9 after-measurement and the single memo trial with a recorded decision. Testing: Task 2 pins behaviour before any extraction, Task 5 unit tests the view model, Task 9 adds the size test; every task re-runs the baselines and the CSS diff check. Delivery: one PR per task, Astra-6 candidates are Tasks 6, 7 and 8 once Task 5 has merged. Not in this plan: the research screen (Plan 2), the 0.10.0 version bump (after Plan 2).
- **Placeholders.** Moved JSX is referenced by its exact `className` anchors with the handler substitutions spelled out; no step says "similar to" or "add handling".
- **Type consistency.** `Panel` is defined in Task 6 and consumed in Task 7; `Campaign` in Task 3 and consumed in 6–9; `displayed` (`{ run, tick }`) from Task 5 feeds Task 9's `ResearchOverlay`; `GuideProps` in Task 6 matches the composer's object literal.
- **Review Focus.** Items 1–4 are Task 2 tests re-run by every later task; item 5 is Task 9's second test.
