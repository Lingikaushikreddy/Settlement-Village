# Objective agents verification

Verified locally on 2026-09-16 against the existing single-player village.

- `npm test`: 78 passed, zero failures, including 21 new crew and integration tests.
- `node --experimental-strip-types --test tests/http.integration.mjs`: one passed.
- `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`: passed.
- The full browser flow used an isolated production-preview origin, preserving the user's village save.
- Raid preparation began with zero troops and 954 gold, 530 timber and 965 food. It completed with 14 knights, 12 archers and four catapults ready, and treasury balances of 1,205 gold, 810 timber and 1,095 food. Actual recruitment spending matched the displayed maximum: 670 gold, 120 timber and 870 food.
- The inspector displayed real recruitment memories, ready troop counts, reserve targets and spending. Completion stopped the crew and offered player-controlled scouting.
- A restock objective recorded Theo resting and Finn taking the gold collection job; other residents claimed food and timber work.
- Entering Research paused the crew. Returning to Village showed Resume crew, with treasury balances unchanged by research. Reload preserved the objective, army, treasury and remembered actions in a paused state.
- Desktop and 390 × 844 phone checks covered the board, resident inspector, shared jobs and scrollable history. Captured browser error logs were empty.
- On the final rebuilt preview, collapsing Village orders hid its controls and exposed the map; expanding restored them. Resume crew completed the saved restock objective with 1,751 gold, 1,210 timber and 2,095 food, then stopped at 100%. The event summary identifies the acting resident. Reload also collapses the chapter panel when a crew objective exists.
- Code review found that an enclosed first barracks could block recruitment despite an accessible second barracks. The planner now prefers a reachable completed barracks; the exact scenario has a regression test, observed failing before the fix and passing afterward. The root agent inspected the final correction and full test result; a requested second reviewer pass was unavailable because that agent hit its usage limit.

Core tests additionally verify depleted-treasury completion, collection conservation, exclusive claims and rest handoff, manual recruitment, capped spending, rerouting, unreachable and constructing workplaces, cancellation, bounded unique event IDs, offline/raid/results-screen isolation, malformed-save rejection and deterministic save/resume.

No paid model calls were made. The crew uses deterministic policies. Optional live Claude decisions remain confined to configured local-worker Research experiments. This verifies the local gameplay loop; no hosting deployment, multiplayer or model-driven campaign behavior is claimed.
