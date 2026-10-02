# v0.3.0 verification

Verified on 2026-10-02 with Node 24.5.0, an isolated local production preview, and desktop/phone browser viewports. The existing player origin and its saved campaign were not used for these tests.

## Automated checks

- **112 unit and behavioral tests passed.** Fifteen new development tests cover actual building/upgrade timers, prerequisite retention, exact spending, reserve floors, depleted resources, busy builders, occupied/unreachable sites, manual construction adoption, serial uniqueness, cancellation, rest and deterministic save restoration.
- Two additional availability tests verify real command constraints without mutating the campaign.
- **HTTP worker integration passed.** Controls, origin protection and the event stream remained functional.
- **120 reference evaluation cases reproduced exactly**, including every checkpoint, evidence checksum and aggregate.
- TypeScript, ESLint and production build passed.
- Independent review exercised 24 deterministic campaigns with manual interference and repeated save/restore, checking 6,928 simulated ticks against the state schema and spending/reserve limits.

Commands: `npm test`, `npm run test:integration`, `npm run evaluate -- --verify docs/evaluation-results.json`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Browser evidence

- Fresh campaign: reviewed the development preview, started Grow the village, watched collection and construction, and opened View plan directly into the Village plan tab.
- The objective reached 100% only after the new farm finished level 3; the Town hall reached level 2. The ledger recorded exactly **1,560 gold and 1,240 timber**. Treasury immediately after the final payment was **253 gold / 204 timber / 750 food**, above the protected floor. A later manually claimed milestone added 100 gold.
- Reload preserved all seven buildings, completed objective, spending and milestone status. No construction purchase was replayed.
- The journal displayed real production and stores; claiming a completed milestone disabled its reward control. Escape returned keyboard focus to the journal launcher.
- Unaffordable construction and upgrades were disabled with specific shortage explanations. Recruiting five knights updated the actual treasury and training queue.
- A real Thornwood raid deployed knights, archers and catapults, destroyed 100% of the stronghold, earned three stars and credited **500 gold / 350 timber / 200 food** on return. The finished development objective stayed at 100% after those troops were spent.
- A separate free browser research experiment advanced through tick 9 and its first incident. Replay verification passed; campaign treasury stayed unchanged at **1,178 gold / 554 timber / 825 food**. Live model controls remained disabled without a configured worker.
- Council and Research retained the same named resident portraits. No browser error logs were recorded during these flows.
- Responsive checks covered 1440×900, 1280×720, 390×844 and 320×740. They included collapsed orders, readable shop costs, journal scrolling, building details, compact action notices, camera controls, placement instructions and persistent sound access.

The screenshots in `docs/media/village-v3.png`, `development-v3.png`, and `village-mobile-v3.png` capture the actual application. The decorative valley artwork is separately disclosed in [art provenance](art-provenance.md).

## Limits

This verification covers the local single-player application and deterministic agents. No paid provider was contacted, no multiplayer backend was added, and no hosted game server was deployed. Model-provider behavior remains covered by injected responses and the existing local worker tests. A live provider smoke test still requires explicit configuration.
