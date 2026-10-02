# Objective-driven village agents

The player sets a shared goal; six residents coordinate real collection, recruitment, construction and upgrades in the playable village. The three preset objectives use the same treasury and commands as manual play.

## Play the loop

Open **Village orders → Prepare for a raid**. The displayed recruitment budget is the maximum the crew can spend for this objective. The target is **30 ready troops**, **1,200 gold**, **800 timber** and **600 food** in the treasury. Existing troops and queued recruits count toward the recruitment plan. Completion waits for the troops to finish training.

Residents collect existing building stores and queue missing troops through the same commands used by manual controls. You can keep building, moving buildings, collecting and recruiting yourself; they re-evaluate what remains. Resource collection transfers a whole store, so the result may exceed a reserve target. No resources are created as an objective reward. A completed objective stays finished until you choose another; attacking is your decision.

**Restock supplies** instead sets each reserve target to its starting balance plus 300. This objective never spends treasury resources.

**Grow the village** opens a reviewable development plan. After choosing **Start village development**, the crew builds one additional farm and raises it to level 3. Town hall level 2 is a prerequisite for the final farm upgrade.

## Development plan and authorization

A fresh village has these steps:

| Step                      |      Gold |    Timber | Prerequisite                       |
| ------------------------- | --------: | --------: | ---------------------------------- |
| Town hall level 2         |       960 |       640 | None                               |
| Build an additional farm  |       120 |       120 | None                               |
| New farm level 2          |       192 |       192 | Farm construction finished         |
| New farm level 3          |       288 |       288 | Farm level 2 and Town hall level 2 |
| **Maximum crew spending** | **1,560** | **1,240** | **No food spending**               |

The plan preview reflects the current village. A ready level-two-or-higher Town hall removes that prerequisite step. A Town hall upgrade already underway keeps a waiting step with zero additional cost. Once started, the plan, dependency graph and total spending ceiling are frozen. The crew never expands that allowance automatically.

Every development payment must leave at least **250 gold, 200 timber and 150 food** in the treasury. This floor constrains crew payments; manual actions still use their usual rules. Residents collect real stores to fund remaining work and restore the floor after other spending. No objective-completion reward is created. Journal milestone rewards are separate and require the player to claim them.

Independent tasks can use the two builders together. The new farm must finish building before its first upgrade, and the last upgrade waits for the Town hall prerequisite. A completed prerequisite remains complete while later work proceeds. The objective finishes when the additional level-three farm is ready and the treasury reserve targets are met.

Sites are selected deterministically from unoccupied, reachable tiles, avoiding resident positions and preserving access to existing reachable productive workplaces. Manual construction on a proposed tile triggers replanning. A new farm you build after the objective starts can satisfy the farm target; manual upgrades also satisfy their corresponding steps without duplicate payment. Once chosen, the additional farm's identity persists in the plan.

The plan shows **Prerequisite first**, **Ready for a resident**, **Waiting**, **Under construction**, or **Complete**, with the current reason and location when available. Residents wait when both builders are busy, funds would breach the reserve floor, no reachable site exists, the building limit is reached, or the frozen spending allowance is insufficient.

## Inspect and direct the crew

**View plan** opens the crew inspector:

- **Resident:** current decision, short action plan, position, completed jobs, bounded practice points and recent memories.
- **Village plan:** exclusive owners, unavailable workplaces, resource targets and actual spending against the limit. Development additionally shows the approved steps, prerequisites and progress.
- **Village log:** recorded claims, actions, handoffs and completion.

Use **Give [resident] a 20-tick rest** while the crew runs to release that resident's claim. Other available residents can take it over. Collapse **Village orders** to see more of the map, especially on a phone.

## How the layers connect

| Layer                 | Implementation                                   | Visible result                                                                                                                    |
| --------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| World                 | `model.ts`, `economy.ts`, `battle.ts`            | Buildings produce resources; construction uses builders and game-clock timers; ready troops enter your army.                      |
| Agent behavior        | `crew.ts`, `crew-types.ts`, `development.ts`     | Current needs and frozen construction dependencies produce jobs; role suitability, experience and walking distance choose owners. |
| Tools and persistence | `commands.ts`, `persistence.ts`                  | The same validated collect/train/build/upgrade commands serve agents and players; saves preserve plans, spending and claims.      |
| Player view           | `crew.tsx`, `development-panel.tsx`, `scene.tsx` | Shared resident identities, actual route previews, construction markers, plan inspection and an action log expose what happened.  |

At most one resident owns a job, and each resident owns at most one job. Paths traverse empty tiles on the existing village grid. Agents re-evaluate moved or inaccessible workplaces; recruitment prefers a completed, reachable barracks. They wait with a visible explanation when resources, buildings or remaining spending allowance are insufficient. Training is queued in batches of up to five and waits for the current queue to finish before starting the next batch.

One crew tick equals one live simulation second. Movement advances one tile per tick, followed by work at the destination. Pausing retains claims. Cancelling releases them while keeping completed work, spent resources, experience and recent memories. Construction and training already paid for continue on their existing timers; cancelling the crew does not refund or undo them. Practice adds a small, capped influence to future job selection.

## Boundaries and continuity

Crew decisions pause offline, during raids including their results screen, and when opening Council or Research. Starting or resuming the crew pauses Council stories. Returning from Research does not automatically resume the crew. Production and existing training timers continue under the game's existing timing rules.

Version-2 saves without crew data still load. Older crew version-1 records remain compatible. Development data is optional for older objectives and validated when a development objective is present, including the dependency structure, spending ceiling and exclusive claims. A saved objective resumes **paused**, retaining its plan, jobs and memories. Only the latest 120 events and 12 memories per resident are kept; this log is a bounded gameplay record, not an immutable audit history.

The same named residents appear in Council and Research, but those authored social scenarios have separate evidence and memory records. Their chapter/tick labels identify that context. The crew inspector describes current campaign work. Portraits and map characters share the same illustrated civilian identity across these views; their separate simulation records remain labeled by context.

## What AI means in this release

The crew uses free, deterministic game AI: shared objectives, task allocation, pathfinding, reactive replanning and bounded experience. It does not call a paid model, train a neural network or interpret arbitrary natural-language goals. Agent tools cover collection, recruitment and the preset farm-development plan. Manual building and upgrades remain available alongside crew work; battle commands remain player controls.

The optional Claude adapter is available separately for explicitly configured local-worker Research experiments. It remains disabled by default and does not control the campaign crew. Arbitrary construction blueprints, agent-led combat, persistent social relationships and model-driven campaign decisions remain future extensions.
