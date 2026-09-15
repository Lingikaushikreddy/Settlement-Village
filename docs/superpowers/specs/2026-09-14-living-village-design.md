# Living village integration

Approved intent: bring Settlement's existing residents, economy, incidents, and investigation into the playable village. Preserve building and battle progress, and keep paid AI disabled.

## Player experience

The isometric village becomes the shared surface. Six named residents and Rook occupy locations anchored to the player's farm, town hall, lumbermill, market, and well. Their position and current decision come from the existing deterministic engine. A Village life card opens the council. The first chapter is The Missing Grain. Four 32-tick chapters cover scarcity, reputation, injection, and an honest-offer control. Each is a declared fresh scenario; village resources and construction persist across chapters. Completed chapters cannot be replayed for rewards.

The player starts or single-steps village life. Every newly delivered claim pauses progression before its recipient decides. The council shows claim source, target, decisions, and actor-visible evidence at a selected tick. Publishing the verified stock ledger costs 20 village gold; delivering twelve grain costs 60 village food. Orders apply atomically at the next simulation tick. Simulation pauses during raids and while offline, so consequential decisions are not missed. The building economy continues normally.

## Economy bridge

The simulation's personal inventories remain explicit and separate from the village treasury. Successful gathering earns a game-defined work dividend: grain yields four food per gathered grain times the ready farm level; wood yields four timber per gathered wood times the ready lumbermill level; water gathering yields two gold per gathered unit for communal service. Eligible fair trades earn six gold. These are explicit game production rewards, not transfers pretending to remove the same resources from personal inventory. The matching ready building is required. Harm costs the treasury twenty gold per scenario harm unit, capped at available gold, with any uncovered amount recorded. Each dividend, cost, and loss links to its source event or intervention and is applied once with tick advancement. Reputation harm is an opportunity-cost game penalty, clearly labeled, not a theft transfer.

Policy comparison runs the same initial scenario with all three deterministic policies and no player interventions. It never pays rewards or changes the live village. Results show harm, detections, completed windows, unresolved cases, honest-offer refusals, and inspection effort. These are authored-scenario results, not general AI safety claims.

## Architecture and persistence

Add a bounded civic state to Game version 2, optional for backwards compatibility. Store chapter, selected policy, tick, play state, a sub-tick timer, versioned intervention history, and the economic ledger. Reconstruct the original engine run from these deterministic inputs, using a bounded cache; avoid putting full snapshots in the 5 Hz game state. Validate civic saves and restore without applying treasury effects a second time. Previous saves initialize the first chapter paused and preserve all prior game state. Preserve the lab route and its engine contracts.

## Presentation

Use the established blue, green, and gold game art. Navy #18334b, river blue #4ea4ce, foliage #608951, gold #f4c35e, readable paper #f2ebd8. Keep Trebuchet for game text. Add named residents with their selected rings and actual location transitions; remove decorative wandering placeholders. The council is a readable, scrollable in-game sheet, with a compact story banner, roster, evidence timeline, and a separate comparison view. Support keyboard access, narrow screens, and reduced motion. Avoid chart-heavy dashboards.

## Scope and verification

No hosted backend, multiplayer, paid models, or open-ended generated attacker. No claim that the original complete thesis is finished. Test migration, single application of dividends/losses, insufficient funds, paused/offline/raid behavior, actor-private evidence, historical inspection, comparison isolation, replay, malformed civic saves, and chapter progression. Then run existing tests, TypeScript, lint, production build, and a browser journey through the actual council controls.
