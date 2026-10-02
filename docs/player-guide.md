# Settlement

Set the objective. Watch your residents organize the work. Lead raids beyond the treeline.

Settlement is a single-player village strategy game with an original illustrated isometric world and an integrated, inspectable resident simulation. Six residents coordinate collection, construction, upgrades and recruitment toward your objectives, move through the playable village, and adapt when work becomes unavailable. Their actions use the same treasury, buildings and army as manual play. Council stories and the investigation lab remain in the same app and share its map. `/lab` redirects to Research.

## Play locally

Use Node 24+ and npm:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. The village game needs no API key, database, or paid AI. If dependencies are already installed, only `npm run dev` is needed.

## Give the village an objective

Choose one of three objectives in **Village orders**:

- **Grow the village:** review a plan to build one additional farm and raise it to level 3. Residents also upgrade the Town hall to level 2 if needed.
- **Prepare for a raid:** ready 30 troops and treasury reserves of 1,200 gold, 800 timber and 600 food. The displayed recruitment budget is the crew's maximum spending allowance.
- **Restock supplies:** collect at least 300 more of each resource than the starting treasury balance. This objective never spends resources.

For village growth, choose **Grow the village → Start village development** after reviewing the plan. A fresh village authorizes **1,560 gold and 1,240 timber**, with no food spending. Every crew payment keeps at least **250 gold, 200 timber and 150 food** in reserve. A Town hall already at level 2 needs no prerequisite upgrade; an upgrade you already paid for contributes no new cost. The preview follows current village conditions until you start, then the plan and maximum budget stay fixed.

The new farm must finish construction before its level-2 upgrade. Its level-3 upgrade also needs the Town hall prerequisite. Independent work can share the two builders. Residents wait visibly for supplies, a free builder or a reachable site. They use real building stores and commands; starting an objective does not grant resources. If you place an additional farm or finish a planned upgrade yourself, the crew adopts that progress and avoids paying for it again. If you occupy a proposed site, residents choose another suitable location.

Open **View plan** or select a resident. **Resident** explains the current job, route, practice points and memories. **Village plan** shows development steps, dependencies, owners, waiting reasons, reserves and actual spending. **Village log** records actions and handoffs. A selected resident's route reflects the same walkable path used for work.

Give a working resident a **20-tick rest** to release their job for someone else. Only one objective runs at a time. Pause or cancel it from the inspector; paid work and construction already underway remain in the village. Cancellation does not refund spending. Collection transfers a whole building store, so balances may exceed targets. After a raid objective finishes, **Scout a raid** lets you decide when and where to attack.

Crew decisions run at one tick per live second and pause offline, during raids, or when you enter Council or Research. Restored saves pause the crew until you resume. Production and training timers continue. This is free, deterministic game AI with job bidding, pathfinding and bounded experience—not language-model calls or neural training. See [Objective agents](objective-agents.md).

## Build and command manually

1. Tap the gold, timber and food bubbles above productive buildings.
2. Open **Build**, choose a building, and tap an empty diamond to place it. Construction consumes resources and occupies one of two builders.
3. Select a building to collect, upgrade, or move it. Town hall upgrades unlock higher building levels. Build, upgrade and training controls show why an action is unavailable, including resource shortages, busy builders and a full army camp.
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

Drag empty ground to pan. **Zoom in**, **Zoom out** and **Center village** adjust the camera; centering fits the village into the available map area. With the map focused, use the **arrow keys** to pan, **+ / −** to zoom and **Home** to fit the village. Collapse Village orders or the chapter panel for more map space. Sounds are optional and start muted.

Open **Village journal** for your four milestone goals, trophies, current production rates and stored resources. Completed milestones offer a one-time gold reward to claim; these are separate from the crew's objective budget. Select a resident portrait to open their inspector. **Open the field guide** explains building, objectives and expeditions and gives access to save import/export. The village crest also opens this guide.

The village saves player actions and imports immediately, and ongoing simulation every two seconds. It also attempts to save when the page becomes hidden or closes. A forced browser termination can still lose the most recent simulation interval. Production and training progress while you are away, with offline advancement capped at eight hours. Raids resume from their last saved state. Use the village crest to open the guide and export or import a JSON save.

Only one tab can own the campaign for a given browser origin. If another tab is active, close it and choose **Retry after closing other tab**; the waiting tab then loads the latest save. A waiting tab cannot simulate or overwrite your village. This requires a browser with Web Locks support on localhost or HTTPS. Different browser profiles, devices and origins still have separate saves.

If a save cannot be loaded, Settlement preserves it and offers **Export original save**. Starting over requires **Start a new village → Replace saved village**. Browser data can still be cleared or evicted; exported saves provide a portable backup.

## Implemented game systems

- Six building types, tile placement and relocation, five levels, two builders, resource costs and storage limits.
- Gold, timber and food production, atomic collection, timed upgrades and troop training.
- Three troop types with different health, movement, attack range and damage.
- Three enemy strongholds, deterministic combat, focus targeting, tower attacks, troop deaths, destruction, stars, and rewards credited once.
- Village goals, campaign unlocks and trophies.
- Three player objectives, six cooperating residents, exclusive job claims, walkable routes, real collection, construction, upgrades and recruitment, frozen development plans, spending limits, protected reserves, rest handoffs, bounded experience, saved memories and a visible action log.
- Six autonomous residents, one authored Chaos agent, named map interactions, four social chapters, bounded planning, private evidence inspection, historical playback, chief interventions, a treasury audit trail, and matched policy comparisons.
- Original generated terrain, building/troop artwork and six distinct civilian identities shared across map and inspectors; movement, attack and construction cues, responsive controls and reduced-motion support.
- A village journal with milestones, production summaries and resident shortcuts, plus pointer and keyboard camera controls.

This is a playable single-player browser release. It does not yet include multiplayer clans, PvP matchmaking, enemy attacks on your home village, a server-authoritative economy, or a full commercial content/live-operations system. The home watchtower is currently a village building; its combat behavior is used by enemy towers during raids. Building upgrades increase production and progression; level and construction markers identify their current state.

## Architecture and verification

`lib/game` contains pure economy, battle, crew and council transitions. The crew planner in `crew.ts` uses the same validated actions in `commands.ts` as manual play. Its optional versioned save state preserves objectives, development dependencies, positions, claims, spending, experience and memories; loading pauses decisions. The council adapter reuses the free policy path in `lib/sim` and reconstructs versioned scenario runs from compact saved inputs, with a bounded run cache. It does not store full simulation snapshots inside every game tick. Version-2 saves without council or crew data preserve previous progress. `components/game` renders the interactive village and game controls. All art used by the game is stored in `public/game`.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The game tests cover atomic placement and spending, duplicate collection, upgrade timing, training payment, offline limits, save validation, deterministic combat, reserve expenditure and reward idempotency. Crew tests cover real objective completion, empty-treasury recovery, exclusive claims, rest handoffs, blocked workplaces, alternative barracks, spending limits, manual interference, save validation and deterministic continuation. Development tests additionally cover prerequisite readiness, actual construction timers, protected reserves, occupied builders, unreachable or changed construction sites, unique building IDs, manual work adoption and preserved progress during subsequent upgrades. Council tests additionally cover migration, production dividends, ready workplaces, incident pauses, paid interventions, replay-safe reloads, fair reputation trades, actual treasury losses, private historical evidence, read-only comparisons, chapter progression and invalid saves. The original engine and worker tests remain in the suite. See [v0.3.0 verification](village-v3-verification.md) for the release checks.

The village council runs locally. The optional SQLite worker powers durable research experiments inside the same interface; campaign saves remain browser-local. Claude decisions are connected to explicit worker experiment steps, disabled by default. Model actions use actor-visible evidence, validated actions, persisted responses and usage, budget reservations, idempotent requests, and replay without additional provider calls. They currently affect experimental worlds, not campaign currency. See [Research guide](observatory-guide.md) and [Live model setup](live-models.md).

## Art provenance

The terrain and sprite atlas were generated with the built-in image-generation tool for this project, then copied into `public/game/terrain.png` and `public/game/sprites.png`. They are original assets, not extracted game assets. Prompts specified colorful orthographic isometric terrain with an empty buildable clearing, and a transparent 3 × 3 atlas of six buildings and three units. No external franchise logos or character designs were requested. The well and market props are project-authored SVG artwork. Six distinct civilian identities use the project's `residents-v3.png` artwork across the map, crew inspector, Council and village journal. The illustrated village vista is also project artwork. See [Art provenance](art-provenance.md) for the generated asset details.

## Current simulation limits

The objective crew uses deterministic policies and a bounded experience score, not neural learning. It supports three preset objectives, including bounded autonomous construction and upgrades for an additional level-three farm. Arbitrary natural-language goals, unrestricted construction planning and agent-led combat are not implemented. The council has fixed initial trust tendencies, authored Rook claims and four finite scenarios. Crew memories and Council evidence are separate records, identified by their respective views; this is not an open-ended generative society. Persistent relationships across chapters, automatic model-driven campaign play, public immutable replay links, production multi-user operation, and the complete research-inspired thesis remain outside this release. Optional model-assisted interpretation is available only for explicit steps in configured worker experiments.
