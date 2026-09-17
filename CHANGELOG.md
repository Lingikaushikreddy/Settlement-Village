# Changelog

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

Campaign agents use deterministic policies. Multiplayer, arbitrary natural-language goals, autonomous construction and model-driven campaign decisions are not included.
