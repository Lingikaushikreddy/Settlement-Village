# UI architecture design

Date: 2026-10-10. Sub-project 3 of the open-source upgrade (after foundation cleanup, testbed distribution, scenario authoring and showcase).

## Purpose

Make the interface readable and safe to change for outside contributors. Today two files carry most of it: `components/game/game.tsx` (1,421 lines, about 20 state atoms) and `components/observatory.tsx` (1,429 lines, about 20 state atoms). A contributor who wants to change the build dialog or the playback timeline has to read a thousand lines of unrelated state first, and a reviewer cannot tell from a diff which behaviour a change touches.

The maintainer chose contributor readiness over runtime performance as the first goal. Performance work is limited to what a measurement shows, and the map stays a DOM scene.

## What this sub-project does not change

- Engine behaviour, the agent protocol, the report format and the scenario schema. `docs/evaluation-results.json` and `public/examples/agent-report.json` verify unchanged at the end of every PR.
- The campaign save format, the `CampaignSession` lock and recovery flow, and the URL parameters (`seed`, `scenario`, `policy`, `view`, `report`).
- Any CSS. Stylesheets may move with the component that imports them, but their bytes do not change. This is the lesson from the council.css incident in the foundation cleanup, where a stylesheet edit removed the map residents from the live site for an hour.
- The three screenshot baselines (`tests/e2e/visual.spec.ts`, home, council and research views) at the existing 0.1% pixel threshold.
- `components/game/scene.tsx`, `crew.tsx`, `council.tsx` and `components/experiments.tsx`. They are large too, but they are self-contained and out of scope; the pattern established here is how a later change would split them.
- Dependencies. No test-renderer, no jsdom, no React Compiler.

## Approach

Extract by surface. Each screen keeps one thin composer and gains focused neighbours: a hook that owns the screen's non-visual state and effects, one file per visible region, and `.ts` view-model modules for logic that needs tests. A region owns the state that only it reads; shared state stays in the composer and flows down as plain props. No React context is introduced.

Two alternatives were considered and rejected: turning on the React Compiler with hooks only (files stay near a thousand lines, and the compiler interacts with the existing mutable-ref patterns), and a store rewrite with a canvas map (highest risk to the baselines and the save flow, with no measurement to justify it).

## Target layout

### Campaign (`components/game/`)

| File | Owns | Size limit |
|---|---|---|
| `game.tsx` | `SettlementGame` (mounts the session, renders `SessionGate` or `CampaignGame`) and the `CampaignGame` composer: shared UI state (selected building, open panel, placing, council/crew open flags, resident), the `Scene`, `CrewInspector` and `CouncilPanel` mounts, and the layout of the regions below. | 330 lines |
| `session-gate.tsx` | `useCampaignSession` (opens the session, retries, re-opens after the back-forward cache) and the blocked, unsupported, recovery and unavailable screens with the export-original-save action and the replace confirmation. | 200 lines |
| `use-campaign.ts` | The game ref, the 200 ms advance loop, the 2 s autosave, the visibility-change save, shutdown registration, `update`, `act`, `crewAct`, the notice and saved messages with their timers, the sound flag and the chime. Returns `{ game, update, act, crewAct, latest, notice, setNotice, saved, sound, setSound, chime }` with stable callbacks. | 250 lines |
| `campaign-hud.tsx` | The header: village name, resources, builders strip, sound and navigation buttons. Props: `game`, flags, callbacks. | 200 lines |
| `selection-panel.tsx` | The building panel for the selected building: upgrade, move, troop training entry, close. | 250 lines |
| `campaign-footer.tsx` | The bottom bar that hosts `CrewBoard` and `VillageJournal` plus the quest and guide shortcuts, and the save status shown under the same condition. | 150 lines |
| `campaign-dialogs.tsx` | The build, train and raid dialogs. The troop and squad picks stay in the composer because the map's deployment flags share them. | 300 lines |
| `guide.tsx` | The player guide dialog content. | 200 lines |
| `battle-overlay.tsx` | The raid banner, hint with deployment shortcuts, controls, and the results dialog. | 250 lines |
| `research-overlay.tsx` | `useResearchDesk` (which run and section are open, the `ResearchFrame` the Observatory reports, opening from the URL parameters) and the overlay: the research map caption, the lazy `Observatory` mount and its Suspense fallback. | 150 lines |
| `campaign-view-model.ts` | Pure functions the regions call: HUD figures from a `Game`, the displayed run and tick from a `ResearchFrame`, the caption text per research mode. | 150 lines |
| `campaign-shared.tsx` | Leaf module with the helpers more than one region renders: `resourceIcons`, `Cost`, `download`. Region files import it and never each other in a cycle. | 60 lines |

### Research (`components/research/`)

`components/observatory.tsx` moved here in Plan 2. While the split was in progress the old path re-exported `Observatory` and `ResearchFrame`; Plan 2's last task pointed the campaign at `components/research` and deleted that shim. A test in `tests/component-size.test.mjs` keeps it deleted.

| File | Owns | Size limit |
|---|---|---|
| `observatory.tsx` | The composer: wires the two hooks to the regions, holds the view (observatory, experiments, library), the open dialog, the selected event. | 250 lines |
| `types.ts` | `ResearchFrame` and the small prop types shared by more than one region. | 100 lines |
| `use-playback.ts` | `run`, `tick`, `playing`, `speed`, the playback interval, `runToEnd` starts for local runs, the queued intervention. | 200 lines |
| `use-local-worker.ts` | Every call to the local worker on port 8787: health, model status, run list, run load, commands, the EventSource stream and its revision guard, the worker-run list. Exposes `available`, `provider`, `runs`, and functions. Nothing else in the tree may call `fetch` against the worker. | 300 lines |
| `research-tabs.tsx` | The heading and close button, the tools nav, the new-experiment and field-guide buttons, and the evidence boundary strip. | 120 lines |
| `run-overview.tsx` | The scenario strip with "Find an incident", the resident buttons and the `ResidentInspector`. | 120 lines |
| `use-model-context.ts` | The `settlement_inspect_run` and `settlement_seek_tick` tools registered with an in-page `document.modelContext`. | 100 lines |
| `playback-timeline.tsx` | The timeline track, play, pause, step, reset, speed select, intervention select, export and verify buttons. | 250 lines |
| `model-readiness.tsx` | The model step panel and its budget text. | 150 lines |
| `activity-panel.tsx` | The incidents, event feed and public board tabs. | 250 lines |
| `metrics-panel.tsx` | The metrics aside and the coins legend. | 150 lines |
| `run-library.tsx` | The archive view: the campaign's record, the reference run, worker runs and saved runs, with open and export; and `useSavedRuns`. | 200 lines |
| `new-experiment-dialog.tsx` | Scenario, policy and seed draft state and the start action. | 150 lines |
| `event-dialog.tsx` | The event detail dialog. | 120 lines |
| `field-guide-dialog.tsx` | The research field guide. | 150 lines |
| `research-view-model.ts` | Pure functions: visible incidents and latest claim for a tick, incident rows with outcome labels, the saved-library filter that validates and verifies stored runs, metrics selection. | 200 lines |

Size limits are enforced by a test (`tests/component-size.test.mjs`) that lists these files with their limits and fails when one grows past its limit. Files outside the two tables are not checked.

## State and data flow

- The campaign keeps one `Game` object. The hook updates it through `update(fn)` exactly as today: apply, store in the ref, set state, save. Regions never hold a copy of the game; they receive it as a prop or receive the figures the view model derives from it.
- The observatory keeps one `Run` plus a tick. The playback hook is the only writer of `run` and `tick`; the worker hook delivers runs to it through a callback rather than setting state of its own.
- Callbacks that cross a region boundary are created once in the hook or composer with `useCallback`, so a later `React.memo` on a region is effective without rework.
- Error handling stays where it is: the Suspense fallback and the research error boundary around the lazy mount, the toast notice for failed commands, and the session gate for save and lock failures. Extracting a region must not move a `try` block out of the function that owns the side effect.

## Performance policy

Memoization is earned by a measurement, not assumed.

- `scripts/measure-ui.mjs` launches the production build with Playwright's Chromium, attaches a Chrome DevTools Protocol session and records `Performance.getMetrics` deltas (script duration, task duration, layout count, style recalculation count, JS heap) over a fixed 10 s of campaign idle on the home view and 10 s of observatory playback at speed 1. It prints a table and writes JSON to a path given on the command line. It is not a CI gate; numbers differ between machines.
- The measurement runs on main before the first extraction (baseline), after the campaign plan and after the research plan. The three tables go in `docs/ui-architecture-verification.md` with the machine and Node version.
- `React.memo` is applied to the scene and to an extracted region only when a measurement on the same machine shows a drop in script duration for that change. A memo without a recorded drop is removed in review.
- No canvas, no virtualization, no worker threads for rendering.

## Testing

- Node 26 cannot execute TSX (checked on 26.8.1: an unknown file extension error even with type stripping), and this sub-project adds no transform, so there are no render-level unit tests. Logic that needs unit tests leaves the components as `.ts` view-model functions tested under `node --test` in the existing suite.
- Behaviour is covered by Playwright. Before a region is extracted, the behaviour it carries has a test; where one is missing it is added first, against the unchanged code, so the extraction is a pure refactor under a green test. The campaign plan adds: open the build dialog from the HUD and place a building; select a building and read its panel; open research through `?view=research`; the session gate's retry on a blocked tab is already covered. The research plan adds: play, pause and step on the recorded run; open the new-experiment dialog and start a local run; the library lists a saved run; the field guide opens.
- The three screenshot baselines are the regression gate for layout. They must pass unchanged in every PR of this sub-project. A baseline is never re-captured here.
- `tests/stylesheets.test.mjs` keeps guarding the built CSS. In addition, every PR's diff for `*.css` must be empty apart from renames, and the reviewer checks it with `git diff --stat -M -- '*.css'`.
- Lint keeps the React hooks rules from `eslint-config-next`; new hooks must pass them without disable comments except the two already present for the session counters, which move with their code.

## Delivery

- One spec, two plans. Plan 1 covers the campaign, Plan 2 covers the research screen. Each plan runs after the other, campaign first: the campaign is the live game's main screen, and its hook-plus-regions pattern sets the convention Plan 2 follows.
- Each task is one pull request against the protected `main`, squash-merged, authored as the maintainer with no assistant attribution. The ruleset's required check is unchanged.
- Order inside each plan: measurement baseline, missing behavioural tests, the hook, then the regions from the outside in (gate and dialogs before HUD and panels), then the view model, then the size test.
- Mechanical extractions after the hook has landed are candidates for Astra-6 briefs under `docs/superpowers/briefs/`, as the gallery page was. The hooks, the view models and the measurement script stay with the main executor because they decide the boundaries.
- The sub-project ends at version 0.10.0: CHANGELOG entry, `docs/ui-architecture-verification.md` with the three measurement tables, a roadmap note, and the `components/` section of the README updated to the new layout.

## Success criteria

- No file in the two tables exceeds its limit, and the size test enforces it.
- A contributor can find the build dialog, the playback timeline or the worker calls by file name, and each file's props type states what it needs.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` all pass on every PR; the three baselines are byte-for-byte the files on `main` today.
- Both reference reports verify unchanged, and a campaign saved before the change loads after it.
- The measurement tables show no regression in script duration between baseline and end; any memo in the tree has a recorded drop next to it.
