# Objective-driven village agents

The user clarified that the intended product is a playable multi-agent game and selected: “Set objectives like prepare for a raid; agents divide the work and adapt.” This is the approved gameplay direction. Keep the existing village, army, combat, saves and research tools.

## First playable loop

The player sets Prepare for a raid or Restock the village. A six-resident crew bids for work on a public job board using role suitability, route length and current demand. The coordinator awards one claimant per task; residents move through the current buildable grid to the actual workplace and execute validated collection or training commands. Training and collection change the real campaign economy. There are no completion rewards or synthetic resource payouts.

Raid preparation aims for 30 ready troops and reserves of 1,200 gold, 800 timber and 600 food. Planned recruits favor a 14/12/4 knight/archer/catapult composition but adapt to the existing army and queued troops. The initial recruitment estimate becomes an explicit maximum spending budget. Collection can bring balances above the target because the existing action collects the whole building store. Completion waits for ready troops, not merely queued orders. Restocking aims to add 300 of each resource to the balances at objective start, without spending.

The planner refreshes jobs from actual state each simulation second. Missing funds create collection work; constructing or unreachable workplaces block jobs; occupied training slots and existing queued recruits prevent duplicate orders. Every committed spend revalidates budget, army capacity and available funds. A player can temporarily rest a resident for 20 crew ticks; its task is released and another eligible resident can claim it. Completed work increases a small bounded proficiency score used in subsequent bids. Persistent memories describe actual claims, work and handoffs. This is deterministic adaptation and experience, not neural model training.

## Three layers

1. World: existing authoritative commands, resource stores, buildings, training queue and combat.
2. Agents: scoped public village state, objective decomposition, task bids, exclusive claims, routes, actions, replanning and memories.
3. Systems: versioned save validation, bounded decision log, replayable deterministic transitions in tests, inspectable reasons and existing optional model research.

The village crew makes free policy decisions. Claude remains optional for research experiments and does not automatically spend money or control crew jobs. The UI names this accurately.

## Boundaries

Crew state is optional in version-2 game saves. Old saves create a paused crew only when needed; save reload pauses crew execution and preserves objectives, claims, routes, spending and memories. No crew work executes offline, during raids, in research, or while council stories are running. Opening Council or Research pauses the crew. Starting a crew objective pauses the council story. Campaign production/training clocks continue normally. A completed objective remains complete until the player explicitly starts another.

Map residents show crew positions and jobs when inspecting the active/recent crew. Council and research continue showing their own clearly labeled scenario records. The same six named residents are reused; no second map is introduced. Rook remains a social-story actor. A compact Village orders card replaces the existing right-side noticeboard and links to the council stories. An expanded crew inspector shows current work, available/blocked tasks, decision reasons and real event history. All controls fit phone and desktop views.

## Verification

Test objective completion from both stocked and depleted villages; resource conservation between building stores and treasury; exact training costs and no duplicate orders; bounded spending after manual changes; exclusive task claims; handoff on rest; rerouting after a building moves; unreachable/building-upgrade conditions; pause, offline and raid isolation; deterministic save/resume; malformed claims and duplicate agent IDs rejected. Browser-check order creation, visible movement, real treasury changes, task explanations, pause/resume, rest/reassignment, research isolation and mobile layout. Retain all existing tests, types, lint and build checks.
