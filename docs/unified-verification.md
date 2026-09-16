# Unified Settlement verification

Verified locally on 2026-09-16.

- `npm test`: 57 passed, zero failures.
- `node --experimental-strip-types --test tests/http.integration.mjs`: one passed, including allowed-origin enforcement and disabled model status/step rejection.
- `npm run typecheck` and `npm run lint`: passed.
- `npm run build`: production build passed.
- Desktop and 390 × 844 phone checks: shared navigation, one map, responsive research desk, resident inspector, browser experiment creation/stepping, replay verification, save/archive, matched policy comparison and return to Village.
- Experiment reached tick 9 with incident harm while campaign resources stayed at gold 954, timber 530 and food 965. Returning to Village restored its current residents and building controls.
- Legacy `/lab?seed=17&scenario=injection&policy=evidence` redirected to the root research view with parameters preserved.
- Production preview at the allowed `127.0.0.1:5173` origin created a local worker run, stepped it, verified its replay, and reconnected through Archive. Captured browser error log was empty.
- Independent code review found an archive ID collision and import isolation issue; both were fixed. A regression test now distinguishes campaign record IDs from existing experiment IDs.
- New model path was tested through injected transports and a fresh HTTP test worker. The previously running development worker requires a restart for new model controls; UI reports this when its status route is absent. No live provider call was made.

Model tests cover recipient-only observations, action/evidence validation, recorded replay and tamper rejection, idempotent dispatch, concurrent commands, budget prechecks, failed-provider reservations and interrupted-request recovery. Existing game/council/engine/worker tests remain passing.

Deployment to Sites was not performed; the existing project identity is retained. This verification covers the local single-player app and optional local worker, not multiplayer or production hosting.
