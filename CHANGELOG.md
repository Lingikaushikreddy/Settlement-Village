# Changelog

## 0.3.0 — 2026-10-02

- **Grow the village:** residents build an additional farm, upgrade it to level 3, and complete its Town hall prerequisite through the same validated commands used by players.
- Reviewable construction steps, dependencies and costs before starting. The plan and spending ceiling then freeze; crew payments preserve 250 gold, 200 timber and 150 food in reserve.
- Construction waits for supplies, reachable sites and one of two builders. Manual construction and upgrades satisfy planned work without duplicate payment; occupied sites trigger replanning. Completion waits for the actual timers.
- Saved plans retain decisions and spending, then restore paused. Existing version-2 campaigns and older crew objectives remain compatible.
- Six distinct illustrated civilian identities shared across the village, resident inspectors, Council and journal; clearer job, route and construction feedback on the map.
- A redesigned strategy interface with compact resource controls, a village journal, production summaries, resident shortcuts and claimable milestone rewards.
- A camera that fits the usable map area, bounded panning, keyboard movement/zoom/fit controls and responsive layouts.
- Build, training and upgrade controls explain resource, builder and capacity constraints before an action is attempted.

Campaign policies remain free and deterministic. The new construction objective is a preset plan; arbitrary natural-language goals, model-controlled campaigns, multiplayer and hosted operation are outside this release.

## 0.2.0 — 2026-09-17

- One shared evaluator powers browser comparisons and the command line, with bounded seed/tick controls, progress and cancellation.
- Compact versioned reports retain each case's metrics, replay checkpoints and evidence checksum. JSON import/paste and CLI verification independently regenerate every case; CSV exports summarize the results.
- The inspector opens seeds actually included in a report. Honest-control-only comparisons run once and absent metric denominators display as not applicable.
- CI independently reproduces the checked-in 120-case reference report.
- Exclusive browser campaign ownership prevents stale tabs from overwriting progress. Closing the owner stops simulation and flushes its latest state before another tab can load.
- Player actions and imported saves persist immediately; ongoing simulation saves periodically and when the page becomes hidden.
- Damaged saves remain intact with an original-data export and explicit replacement flow.

Campaign and comparison policies remain deterministic and free. These changes do not add model-driven campaigns, multiplayer or hosted operation.

## 0.1.0 — 2026-09-16

First public release of Settlement's playable single-player village and agent investigation lab.

- Two objectives coordinated by six residents: prepare a raid and restock supplies.
- Real collection, recruitment, exclusive job claims, pathfinding, rest handoffs, bounded experience and recent memories.
- Village construction, upgrades, resource production, three troop types and three raid strongholds.
- Four Council chapters with evidence inspection, player interventions and treasury consequences.
- Integrated Research and Archive views, seeded policy comparisons, saved experiments, JSON export and replay verification.
- Optional local SQLite worker and explicitly configured Claude social decisions with action validation and usage records.
- Responsive desktop and phone controls, browser-local campaign saves and portable exports.
- 78 gameplay/engine/worker tests plus a separate HTTP integration flow.

At the 0.1.0 release, campaign agents used deterministic policies. Multiplayer, arbitrary natural-language goals, autonomous construction and model-driven campaign decisions were not included.
