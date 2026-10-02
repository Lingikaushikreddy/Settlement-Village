# v0.5.0 verification

Verified on 2026-10-02 with Node 24.5.0, an isolated local production preview, and desktop/phone browser viewports. The existing player origin and its saved campaign were not used for these tests.

## Automated checks

- **160 unit and behavioral tests passed after upstream integration.** Fifteen new development tests cover actual building/upgrade timers, prerequisite retention, exact spending, reserve floors, depleted resources, busy builders, occupied/unreachable sites, manual construction adoption, serial uniqueness, cancellation, rest and deterministic save restoration.
- Two additional availability tests verify real command constraints without mutating the campaign.
- **HTTP worker integration passed.** Controls, origin protection and the event stream remained functional.
- **120 reference evaluation cases reproduced exactly**, including every checkpoint, evidence checksum and aggregate.
- TypeScript, ESLint and the standard Next.js production build passed. The alternative Cloudflare build also passed before upstream integration.
- The external-agent sample report reproduced all **40 cases**, including metrics, checkpoints and built-in baselines.
- The running Next.js production server passed its hosted smoke check, including the two new artwork assets, JavaScript/CSS bundles, security headers and research redirect.
- Independent review exercised 24 deterministic campaigns with manual interference and repeated save/restore, checking 6,928 simulated ticks against the state schema and spending/reserve limits.

Commands: `npm test`, `npm run test:integration`, `npm run evaluate -- --verify docs/evaluation-results.json`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run eval:agent -- --verify public/examples/agent-report.json`, and `npm run smoke -- http://127.0.0.1:5181`.

## Browser evidence

- Fresh campaign: reviewed the development preview, started Grow the village, watched collection and construction, and opened View plan directly into the Village plan tab.
- The objective reached 100% only after the new farm finished level 3; the Town hall reached level 2. The ledger recorded exactly **1,560 gold and 1,240 timber**. Treasury immediately after the final payment was **253 gold / 204 timber / 750 food**, above the protected floor. A later manually claimed milestone added 100 gold.
- Reload preserved all seven buildings, completed objective, spending and milestone status. No construction purchase was replayed.
- The journal displayed real production and stores; claiming a completed milestone disabled its reward control. Escape returned keyboard focus to the journal launcher.
- Unaffordable construction and upgrades were disabled with specific shortage explanations. Recruiting five troops updated the actual treasury and training queue.
- A real Thornwood raid deployed knights, archers and catapults, destroyed 100% of the stronghold, earned three stars and credited **500 gold / 350 timber / 200 food** on return. The finished development objective stayed at 100% after those troops were spent.
- A separate free browser research experiment advanced through tick 9 and its first incident. Replay verification passed; campaign treasury stayed unchanged at **1,178 gold / 554 timber / 825 food**. Live model controls remained disabled without a configured worker.
- The merged Next.js build preserved the campaign, completed objective and Kavyas/Jhansis troop labels. A manual gold mine placement spent exactly 100 gold and 150 timber, completed its timer, and retained the earlier growth objective.
- Council and Research retained the same named resident portraits. No browser error logs were recorded during these flows.
- Keyboard camera checks confirmed that Home resets the fitted view and map focus leaves the clipped viewport’s scroll offset at zero.
- Responsive checks covered 1440×900, 1280×720, 390×844 and 320×740. They included collapsed orders, readable shop costs, journal scrolling, building details, compact action notices, camera controls, placement instructions and persistent sound access.

The screenshots in `docs/media/village-v3.png`, `development-v3.png`, and `village-mobile-v3.png` capture the actual application. The decorative valley artwork is separately disclosed in [art provenance](art-provenance.md).

## Limits

This verification covers the single-player application and deterministic agents. The final release also preserves the upstream Next.js/Vercel frontend and external-agent testbed. No paid provider was contacted and no multiplayer or shared research backend was added. The existing Vercel frontend remains the hosted deployment path. Model-provider behavior remains covered by injected responses and the existing local worker tests. A live provider smoke test still requires explicit configuration.
