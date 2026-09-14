# Settlement

Build a village. Train an army. Lead raids beyond the treeline.

Settlement is now a single-player village strategy game with an original illustrated isometric world. The former observatory remains at `/lab` for inspecting deterministic social-agent experiments.

## Play locally

Use Node 24+ and npm:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. The village game needs no API key, database, or paid AI. If dependencies are already installed, only `npm run dev` is needed.

## Your first expedition

1. Tap the gold, timber and food bubbles above productive buildings.
2. Open **Build**, choose a building, and tap an empty diamond to place it. Construction consumes resources and occupies one of two builders.
3. Select a building to collect, upgrade, or move it. Town hall upgrades unlock higher building levels.
4. Open **Train** to recruit knights, archers and catapults. Your camp holds 40 troops including its training queue.
5. Open **Battle → Scout**. Choose a troop and deploy it from an edge. Switch between deploying one or five at a time.
6. Tap an enemy building to focus attacks. Knights have high health, archers attack from range, and catapults deal heavy siege damage. Enemy towers shoot back.
7. Destroy the town hall, half the village, and every building to earn up to three stars. Return home to receive loot and unlock the next stronghold.

Deployed troops are spent; undeployed troops remain in reserve. Raids last up to 90 seconds after the first deployment. You can end a raid early and keep rewards for the structures already destroyed.

## Progress and controls

Drag empty ground to pan. Use the zoom and center buttons to adjust the camera. Collapse the chapter panel for a clearer view. Sounds are optional and start muted.

The village automatically saves to this browser every two seconds. Production and training progress while you are away, with offline advancement capped at eight hours. Raids resume from their last saved state. Use the village crest to open the guide and export or import a JSON save. Keep one active game tab per browser to avoid competing saves. Browser data can be cleared or evicted; exported saves provide a portable backup.

## Implemented game systems

- Six building types, tile placement and relocation, five levels, two builders, resource costs and storage limits.
- Gold, timber and food production, atomic collection, timed upgrades and troop training.
- Three troop types with different health, movement, attack range and damage.
- Three enemy strongholds, deterministic combat, focus targeting, tower attacks, troop deaths, destruction, stars, and rewards credited once.
- Village goals, campaign unlocks and trophies.
- Original generated terrain and a transparent sprite atlas, animated troop movement, attack effects, responsive controls and reduced-motion support.

This is a playable single-player browser release. It does not yet include multiplayer clans, PvP matchmaking, enemy attacks on your home village, a server-authoritative economy, or a full commercial content/live-operations system. The home watchtower is currently a village building; its combat behavior is used by enemy towers during raids. Building upgrades increase production and progression; this version reuses each building's base artwork across levels.

## Architecture and verification

`lib/game` contains pure economy and battle transitions. `components/game` renders the interactive village and game controls. All art used by the game is stored in `public/game`.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The new game tests cover atomic placement and spending, duplicate collection, upgrade timing, training payment, offline limits, save validation, deterministic combat, reserve expenditure and reward idempotency. The original engine and worker tests remain in the suite.

The optional local worker and Claude adapter belong to the original social simulation in `/lab`; they do not power village raids. No paid model calls are enabled. See `docs/observatory-guide.md` for that subsystem's commands and limits.

## Art provenance

The terrain and sprite atlas were generated with the built-in image-generation tool for this project, then copied into `public/game/terrain.png` and `public/game/sprites.png`. They are original assets, not extracted game assets. Prompts specified colorful orthographic isometric terrain with an empty buildable clearing, and a transparent 3 × 3 atlas of six buildings and three units. No external franchise logos or character designs were requested.

## Hosting

The existing Sites project identity is retained in `.openai/hosting.json`. Publication previously failed because Sites returned `project_not_found`. The local game and source remain independent of that hosting issue. Do not create a duplicate project without resolving that identity/access mismatch.
