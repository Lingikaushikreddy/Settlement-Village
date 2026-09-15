# Living Village Implementation Plan

> Execute inline in the current isolated Settlement repository. Use test-driven-development for new state transitions and verification-before-completion for delivery.

**Goal:** Integrate inspectable resident decisions and their economic consequences into the existing village game.
**Architecture:** Keep sim-core unchanged. A council adapter reconstructs bounded scenario runs from compact saved inputs; a pure bridge applies their gameplay consequences exactly once. The game scene and council inspector consume the same run.
**Tech Stack:** Existing TypeScript, React, CSS, Zod, Node test runner. No new dependency or paid API.
**Spec:** ../specs/2026-09-14-living-village-design.md

## Global constraints

Preserve version-2 saves and all battle progress. Pause social simulation offline and during raids. No paid model calls. Four chapters of 32 ticks. Use existing engine evidence permissions. Keep each treasury effect tied to its source. Comparisons cannot mutate live gameplay.

- [x] Task 1: Add behavioral tests in tests/council.test.mjs for migration, dividends, incidents, queued costs, replay-safe persistence, and isolation. Run and observe expected missing-feature failures.
- [x] Task 2: Add lib/game/council.ts for compact state, deterministic reconstruction, economic bridge, chapter controls and validation. Extend model, economy ticking and persistence. Run council and existing tests.
- [x] Task 3: Add components/game/council.tsx and council.css for story, resident evidence, timeline, ledger and matched policy comparison. Replace decorative villagers in scene.tsx with engine residents anchored to village buildings. Wire game.tsx controls and save restoration. Check types and lint.
- [x] Task 4: Exercise the in-game journey on an isolated local origin, check mobile sizing and keyboard controls, and fix verified defects. Run full tests and production build. Update README, plan and source archive. Preserve the user's active save.


## Verification record — 2026-09-15

- `npm test`: 46 tests passed, zero failed (12 council regression tests plus the original 34).
- `npm run typecheck` and `npm run lint`: exit 0.
- `npm run build`: production client/RSC/SSR build completed; `/` and `/lab` retained.
- Independent read-only review found two issues. Both were reproduced with failing tests and fixed: legitimate reputation trades now pay the six-gold fair-trade dividend; residents who already accepted/refused are distinguished from those still awaiting a decision. Archive selection also pauses a running live day.
- Production browser verification used `127.0.0.1:5180`, preserving the user's `localhost:5173` save. It loaded the existing QA save (hall level 2, seven buildings), added a paused council, and preserved its 958/490/925 resource balances.
- Started the village day, observed auto-pause at tick 8 with a pending claim targeting Theo. At tick 9, publishing stock cost 20 gold, produced Theo's refusal/detection, and exposed the linked intervention event in Treasury trail. Reload restored tick 9 paused with 954 gold / 530 timber / 957 food, without duplicate effects.
- Browser comparison showed matched scarcity runs: baseline harm 8, cautious harm 0, evidence harm 0 with two detections and two inspections. Each evaluated two attacks; model calls/spend remained zero. The live tick stayed at 9.
- Keyboard Home on the timeline returned to tick 0. Live step and intervention buttons were disabled; Return to current restored live inspection.
- At 390×844, the council bounds settled at x=10..380, y=10..834, with an internal scroll area and visible footer. The main page width was 390; quest and life cards occupied separate left/right columns without overlap. Desktop council screenshot visually reviewed at 1280×720. Temporary viewport override reset.
- Completed chapter 1 through 23 UI single-step actions, unlocked chapter 2 at tick 0, viewed chapter 1 in the archive with live controls disabled, returned to chapter 2 and selected Check evidence.
- Browser error log for the tested production journey was empty.

## Delivery limits

This integrates four finite authored stories using the existing deterministic engine. It does not enable paid models, persistent relationships across chapters, multiplayer, or production worker durability. The original Sites project could not be published due to its previously diagnosed access/identity failure. The local preview and source package are the deliverables; no replacement cloud project was created.
