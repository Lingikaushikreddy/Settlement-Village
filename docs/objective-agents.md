# Objective-driven village agents

The player sets the goal; six residents coordinate work in the playable village. This is the first implemented objective loop in the multi-agent game direction.

## Play the loop

Open **Village orders → Prepare for a raid**. The displayed recruitment budget is the maximum the crew can spend for this objective. The target is **30 ready troops**, **1,200 gold**, **800 timber** and **600 food** in the treasury. Existing troops and queued recruits count toward the recruitment plan. Completion waits for the troops to finish training.

Residents collect existing building stores and queue missing troops through the same commands used by manual controls. You can keep building, moving buildings, collecting and recruiting yourself; they re-evaluate what remains. Resource collection transfers a whole store, so the result may exceed a reserve target. No resources are created as an objective reward. A completed objective stays finished until you choose another; attacking is your decision.

**Restock supplies** instead sets each reserve target to its starting balance plus 300. This objective never spends treasury resources.

**View plan** opens the crew inspector:

- **Resident:** current decision, short action plan, position, completed jobs, bounded practice points and recent memories.
- **Shared jobs:** exclusive owners, unavailable workplaces, resource targets and actual recruitment spending against the limit.
- **Village log:** recorded claims, actions, handoffs and completion.

Use **Give [resident] a 20-tick rest** while the crew runs to release that resident's claim. Other available residents can take it over. Collapse **Village orders** to see more of the map, especially on a phone.

## How the layers connect

| Layer                 | Implementation                        | Visible result                                                                                                                          |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| World                 | `model.ts`, `economy.ts`, `battle.ts` | Buildings produce resources; the treasury pays for recruitment; ready troops enter your army.                                           |
| Agent behavior        | `crew.ts`, `crew-types.ts`            | Jobs are derived from current needs; role suitability, experience and walking distance choose owners; blocked work triggers replanning. |
| Tools and persistence | `commands.ts`, `persistence.ts`       | The same validated collect/train actions serve agents and players; saved state preserves objectives, spending and claims.               |
| Player view           | `crew.tsx`, `scene.tsx`               | Map movement, task badges, resident inspection, shared jobs and an action log expose what happened.                                     |

At most one resident owns a job, and each resident owns at most one job. Paths traverse empty tiles on the existing village grid. Agents re-evaluate moved or inaccessible workplaces; recruitment prefers a completed, reachable barracks. They wait with a visible explanation when resources, buildings or remaining spending allowance are insufficient. Training is queued in batches of up to five and waits for the current queue to finish before starting the next batch.

One crew tick equals one live simulation second. Movement advances one tile per tick, followed by work at the destination. Pausing retains claims. Cancelling releases them while keeping completed work, spent resources, experience and recent memories. Practice adds a small, capped influence to future job selection.

## Boundaries and continuity

Crew decisions pause offline, during raids including their results screen, and when opening Council or Research. Starting or resuming the crew pauses Council stories. Returning from Research does not automatically resume the crew. Production and existing training timers continue under the game's existing timing rules.

Version-2 saves without crew data still load. Crew data has its own version and validation for identities, positions, claims and spending. A saved objective resumes **paused**, retaining its jobs and memories. Only the latest 120 events and 12 memories per resident are kept; this log is a bounded gameplay record, not an immutable audit history.

The same named residents appear in Council and Research, but those authored social scenarios have separate evidence and memory records. Their chapter/tick labels identify that context. The new crew inspector describes current campaign work.

## What AI means in this release

The crew uses free, deterministic game AI: shared objectives, task allocation, pathfinding, reactive replanning and bounded experience. It does not call a paid model, train a neural network or interpret arbitrary natural-language goals. Current agent tools cover collection and recruitment; building, upgrades and battle commands remain player controls.

The optional Claude adapter is available separately for explicitly configured local-worker Research experiments. It remains disabled by default and does not control the campaign crew. Autonomous construction, agent-led combat, persistent social relationships and model-driven campaign decisions remain future extensions.
