# Village Game Implementation Plan

> Execute inline with focused verification checkpoints. The approved user choice is village construction and troop battles.

**Goal:** A playable village builder and raid game replacing the dashboard home.
**Architecture:** Pure TypeScript game rules; React game HUD and an isometric scene using a transparent sprite atlas. Local browser persistence, no new network dependency.
**Spec:** ../specs/2026-09-14-village-game.md

- [x] Write tests in tests/game.test.mjs for atomic costs, tile occupancy, training, offline limits, deterministic raids and reward idempotency; run them before implementation.
- [x] Implement catalog.ts, model.ts, economy.ts, and battle.ts in lib/game. Commands return a fresh Game state or throw a player-readable error; time advancement is pure.
- [x] Implement components/game/scene.tsx for the terrain, depth-ordered sprites, deployment tiles, building selection, and camera controls.
- [x] Implement components/game/game.tsx and game.css for resource HUD, goals, build/train/raid dialogs, placement, upgrades, focus targeting, raid results and local save/export. Preserve the observatory at app/lab/page.tsx.
- [x] Run engine tests, lint, type checking and production build; inspect desktop/mobile layouts and complete a village-to-raid browser journey. Fix demonstrated issues, update README, commit and refresh source archive.
- [x] Retry the existing Sites project once; publish only if access is restored. Keep the local preview useful if the service remains unavailable.

Verification: 34 tests passed, TypeScript and lint passed, and the production build completed. Browser checks verified collection, paid placement of a second farm, troop training, town hall level 2, a three-star raid, return with 500 gold / 350 timber / 200 food, and correct remaining reserve. At 390 px the DOM had no horizontal overflow and dialog bounds stayed inside the viewport. Sites still returns project_not_found; no new site was created.
