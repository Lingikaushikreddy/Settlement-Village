# Objective-driven agents implementation plan

**Goal:** Let the player set village objectives and watch residents coordinate real collection and recruitment.
**Architecture:** Pure crew transitions use existing campaign commands. React presents the shared map and a contextual order board. Versioned optional crew state preserves old saves.
**Tech Stack:** Existing TypeScript, React, Zod, Node test runner; no added packages or paid provider calls.
**Spec:** ../specs/2026-09-16-objective-agents-design.md

## Global constraints

Keep the free default, current game saves and council experiments. One objective and six residents, one job per agent and one claimant per job. No resource rewards for completing objectives. Production/training timers continue; crew spending pauses offline, in raids and in research.

- [x] World/agent core: Add `lib/game/crew-types.ts`, `crew.ts`; extract existing commands to `commands.ts` to avoid a circular engine import. Tests in `tests/crew.test.mjs` cover real collection, recruitment, completion, handoff, blockage and budgets. Core exports `newCrew(game)`, `crewCommand(game, command)`, `advanceCrew(game, seconds)`, `crewPreview(game, kind)` and `crewProgress(game)`.
- [x] Save/tick integration: Add optional `crew` to `Game`, schema validation to persistence, call `advanceCrew` only for live short steps, preserve and pause imported crew. Test old saves, invalid claims, replay-equivalent resume and offline/raid boundaries.
- [x] Playable interface: Add `components/game/crew.tsx` and `crew.css` for objective board and resident inspector. Root wires commands, pause rules and map position overrides. Existing Scene presents actual crew positions, task badges and job destinations. Keep Council/Research navigation available.
- [x] Verify/review/deliver: run `npm test`, `npm run typecheck`, `npm run lint`, production build and browser flow on an isolated save origin. Review current diff, resolve findings, update README and source archive.

Core behavior checks start with failing tests. UI changes are verified through actual browser controls. Local implementation choices are covered by the selected objective-driven direction; no new spending authorization or cloud deployment is implied.
