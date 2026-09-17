# Settlement

Set the objective. Watch your residents organize the work. Lead raids beyond the treeline.

Settlement is a single-player village strategy game with an original illustrated isometric world and an integrated, inspectable resident simulation. Six residents coordinate collection and recruitment toward your objectives, move through the playable village, and adapt when work becomes unavailable. Their actions use the same treasury, buildings and army as manual play. Council stories and the investigation lab remain in the same app and share its map. `/lab` redirects to Research.

## Play locally

Use Node 24+ and npm:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. The village game needs no API key, database, or paid AI. If dependencies are already installed, only `npm run dev` is needed.

## Give the village an objective

1. In **Village orders**, choose **Prepare for a raid**. The board shows the maximum recruitment budget before starting. The goal is 30 ready troops and reserves of 1,200 gold, 800 timber and 600 food.
2. Watch residents claim jobs, walk to workplaces, collect existing building stores and recruit missing troops. Production and training take real game time. No objective-completion reward creates extra resources.
3. Open **View plan** or select a resident. **Resident** explains their current job, route plan, experience and memories. **Shared jobs** shows owners, blocked work, reserves and actual spending. **Village log** records actions and handoffs.
4. Give a resident a **20-tick rest** to see available residents take over their work. Moved buildings, blocked routes, construction, manual collection and recruitment cause replanning.
5. When preparations finish, choose **Scout a raid**. You still choose when to attack and command the battle.

For a peaceful goal, choose **Restock supplies** to add at least 300 of each resource to the starting treasury, with no spending. Collection transfers an entire building store, so totals can exceed the target. Only one objective runs at a time. Pause or cancel it from the inspector; completed work remains in your village.

Crew decisions run at one tick per live second and pause offline, during raids, or when you enter Council or Research. Restored saves pause the crew until you resume. Production and training timers continue. This is free, deterministic game AI with job bidding, pathfinding and bounded experience—not language-model calls or neural training. See [Objective agents](objective-agents.md).

## Build and command manually

1. Tap the gold, timber and food bubbles above productive buildings.
2. Open **Build**, choose a building, and tap an empty diamond to place it. Construction consumes resources and occupies one of two builders.
3. Select a building to collect, upgrade, or move it. Town hall upgrades unlock higher building levels.
4. Open **Train** to recruit knights, archers and catapults. Your camp holds 40 troops including its training queue.
5. Open **Battle → Scout**. Choose a troop and deploy it from an edge. Switch between deploying one or five at a time.
6. Tap an enemy building to focus attacks. Knights have high health, archers attack from range, and catapults deal heavy siege damage. Enemy towers shoot back.
7. Destroy the town hall, half the village, and every building to earn up to three stars. Return home to receive loot and unlock the next stronghold.

Deployed troops are spent; undeployed troops remain in reserve. Raids last up to 90 seconds after the first deployment. You can end a raid early and keep rewards for the structures already destroyed.

## Your first village story

1. Open **Council stories** or **Council** in the main navigation.
2. Choose the chapter's social policy: Trust first, Cautious, or Check evidence. Start the village day or advance one tick at a time.
3. At tick 8, Rook's claim pauses the day before the recipient responds. Read the claim and inspect that resident's goal, action, and source evidence.
4. Publish a verified stock ledger for **20 village gold**, deliver **12 communal grain for 60 village food**, or continue and let the policy decide. Each order advances one tick and is recorded alongside its treasury cost.
5. Use the timeline to inspect the past without changing live progress. **Treasury trail** links each work dividend, order, and loss to the exact tick and evidence.
6. **Compare policies** runs all three policies with the same scenario and seed, without your interventions or treasury rewards. It reports harm, evaluated cases, detection, unresolved cases, honest-offer refusals, and inspection effort.
7. Complete each 32-tick chapter to unlock the next: The Missing Grain, A Question of Trust, The Forged Notice, and An Honest Offer. Previous chapters remain in the archive and can be exported with their evidence.

Each chapter begins a fresh authored resident scenario; your village, army, and treasury persist. Completed chapters cannot be restarted for rewards. Social simulation pauses at new claims, during raids, and while offline. Loading a save resumes it paused. No consequential social choices are fast-forwarded while you are away.

### How residents affect your economy

Successful gathering earns a **gameplay work dividend**, separate from the resident's personal inventory: each gathered grain produces four village food multiplied by the highest ready farm level; each gathered wood produces four timber multiplied by the highest ready lumbermill level. Each gathered water earns two gold for communal service when the town hall is ready. Valid fair trades earn six gold. A building under construction or upgrade does not qualify for its work dividend.

Scenario harm costs **20 village gold per harm unit**, capped at available whole gold. Any uncovered amount is recorded, without debt or negative balances. Reputation harm represents a lost-trade opportunity penalty, not stolen funds. Dividends, costs and penalties are applied once as the corresponding tick commits, and appear in the treasury trail. These explicit gameplay rules bridge the simulation to construction and recruitment; they are not claims about real economics or general agent robustness.

## One village, one research desk

Use the navigation beneath the resource bar:

- **Village:** set objectives, inspect coordinated work, build, gather, train and raid.
- **Council:** progress the resident story, intervene and inspect its treasury consequences.
- **Research:** inspect a recorded copy of the current chapter, create experiments, follow private memories and evidence, replay ticks, or compare policies across matched seeds.
- **Archive:** revisit your village record, saved browser experiments, the reference run, and local worker runs.

Research uses the same map. Its caption identifies the viewed run and tick. Entering Research pauses both the campaign's council and objective crew; experiments cannot earn or spend campaign resources. Production and training timers still progress. Return to Village and resume the crew explicitly, or use Council to resume its day. Crew work and Council stories run separately; starting one pauses the other. Save or export a browser experiment before leaving Research. Worker runs keep their durable history; reconnect from Archive. Free policy comparisons never invoke a model.

## Progress and controls

Drag empty ground to pan. Use the zoom and center buttons to adjust the camera. Collapse the chapter panel for a clearer view. Sounds are optional and start muted.

The village automatically saves to this browser every two seconds. Production and training progress while you are away, with offline advancement capped at eight hours. Raids resume from their last saved state. Use the village crest to open the guide and export or import a JSON save. Keep one active game tab per browser to avoid competing saves. Browser data can be cleared or evicted; exported saves provide a portable backup.

## Implemented game systems

- Six building types, tile placement and relocation, five levels, two builders, resource costs and storage limits.
- Gold, timber and food production, atomic collection, timed upgrades and troop training.
- Three troop types with different health, movement, attack range and damage.
- Three enemy strongholds, deterministic combat, focus targeting, tower attacks, troop deaths, destruction, stars, and rewards credited once.
- Village goals, campaign unlocks and trophies.
- Two player objectives, six cooperating residents, exclusive job claims, walkable routes, real collection and recruitment, spending limits, rest handoffs, bounded experience, saved memories and a visible action log.
- Six autonomous residents, one authored Chaos agent, named map interactions, four social chapters, bounded planning, private evidence inspection, historical playback, chief interventions, a treasury audit trail, and matched policy comparisons.
- Original generated terrain and a transparent sprite atlas, animated troop movement, attack effects, responsive controls and reduced-motion support.

This is a playable single-player browser release. It does not yet include multiplayer clans, PvP matchmaking, enemy attacks on your home village, a server-authoritative economy, or a full commercial content/live-operations system. The home watchtower is currently a village building; its combat behavior is used by enemy towers during raids. Building upgrades increase production and progression; this version reuses each building's base artwork across levels.

## Architecture and verification

`lib/game` contains pure economy, battle, crew and council transitions. The crew planner in `crew.ts` uses the same validated actions in `commands.ts` as manual play. Its optional versioned save state preserves objectives, positions, claims, spending, experience and memories; loading pauses decisions. The council adapter reuses the free policy path in `lib/sim` and reconstructs versioned scenario runs from compact saved inputs, with a bounded run cache. It does not store full simulation snapshots inside every game tick. Version-2 saves without council or crew data preserve previous progress. `components/game` renders the interactive village and game controls. All art used by the game is stored in `public/game`.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The game tests cover atomic placement and spending, duplicate collection, upgrade timing, training payment, offline limits, save validation, deterministic combat, reserve expenditure and reward idempotency. Crew tests cover real objective completion, empty-treasury recovery, exclusive claims, rest handoffs, blocked workplaces, alternative barracks, spending limits, manual interference, save validation and deterministic continuation. Council tests additionally cover migration, production dividends, ready workplaces, incident pauses, paid interventions, replay-safe reloads, fair reputation trades, actual treasury losses, private historical evidence, read-only comparisons, chapter progression and invalid saves. The original engine and worker tests remain in the suite.

The village council runs locally. The optional SQLite worker powers durable research experiments inside the same interface; campaign saves remain browser-local. Claude decisions are connected to explicit worker experiment steps, disabled by default. Model actions use actor-visible evidence, validated actions, persisted responses and usage, budget reservations, idempotent requests, and replay without additional provider calls. They currently affect experimental worlds, not campaign currency. See [Research guide](observatory-guide.md) and [Live model setup](live-models.md).

## Art provenance

The terrain and sprite atlas were generated with the built-in image-generation tool for this project, then copied into `public/game/terrain.png` and `public/game/sprites.png`. They are original assets, not extracted game assets. Prompts specified colorful orthographic isometric terrain with an empty buildable clearing, and a transparent 3 × 3 atlas of six buildings and three units. No external franchise logos or character designs were requested. The well and market props are project-authored SVG artwork. Named residents reuse the existing character atlas with identifying labels; distinct animated civilian art is future work.

## Current simulation limits

The objective crew uses deterministic policies and a bounded experience score, not neural learning. It supports collection and recruitment for two preset objectives; natural-language objectives, autonomous construction and agent-led combat are not implemented. The council has fixed initial trust tendencies, authored Rook claims and four finite scenarios. Crew memories and Council evidence are separate records, identified by their respective views; this is not an open-ended generative society. Persistent relationships across chapters, automatic model-driven campaign play, public immutable replay links, production multi-user operation, and the complete research-inspired thesis remain outside this release. Optional model-assisted interpretation is available only for explicit steps in configured worker experiments.
