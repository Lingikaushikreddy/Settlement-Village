# v0.6.0 verification: foundation cleanup

Verified on 2026-10-09 and 2026-10-10 with Node 26.8.1 locally and the GitHub Actions matrix on Node 22, 24 and 26. The design is in [the foundation cleanup spec](superpowers/specs/2026-10-09-foundation-cleanup-design.md); the work landed as pull requests #5, #6, #7, #8, #9, #15 and #16 (#10 to #14 are the first Dependabot pull requests, opened the moment #9 merged).

## What changed, by the numbers

| Measure | Before (v0.5.0) | After (v0.6.0) |
| --- | ---: | ---: |
| Runtime dependencies in `package.json` | 24 | 9 |
| Development dependencies | 18 | 10 |
| Entries in `package-lock.json` | 882 | see `npm ls` below |
| Files in `components/ui/` | 61 | 5 |
| Build systems | 2 (Next.js, vinext/Cloudflare) | 1 |
| `npm audit --omit=dev` | 1 critical, 2 high, 2 moderate | 0 vulnerabilities |
| CI Node versions | 24 | 22, 24, 26 |
| Browser tests | 0 | 7 (Playwright, Chromium) |
| Unit and behavioral tests | 160 | 162 (160 unchanged, plus 2 stylesheet checks) |

Runtime dependencies after: `class-variance-authority`, `clsx`, `lucide-react`, `next`, `radix-ui`, `react`, `react-dom`, `tailwind-merge`, `zod`. Every one is imported by shipped code.

## Automated checks

Each pull request ran the full block on Node 26.8 locally and on the three-version matrix in CI:

```bash
npm test                                                   # 160 passed
npm run test:integration                                   # 1 passed (fixed for Node 26 in #7)
npm run evaluate -- --verify docs/evaluation-results.json  # Verified 120 cases
npm run eval:agent -- --verify public/examples/agent-report.json  # Verified 40 cases
npm run typecheck
npm run lint
npm run build
npm run test:e2e                                           # 5 passed (from #8 onward), 7 after the stylesheet fix
```

- Both reference reports verified unchanged in every pull request; no file under `lib/` or `worker/` changed.
- `npm audit --omit=dev` printed `found 0 vulnerabilities` after #7. Five development-only advisories remain, all the `braces` stack-exhaustion issue reached through `eslint-config-next → fast-glob → micromatch`; `braces` has no patched release and the issue is not reachable from shipped code.
- The worker integration test failed on Node 26 before #7 with `actual: 'retry: 1500\n\n'` and passes after the test reads chunks until the first `data:` line. The worker itself is unchanged.
- `npm run dev:all` was started after the scaffolding removal and served `127.0.0.1:8787/health` and `127.0.0.1:5173`.

## Browser evidence

The Playwright suite runs against the production server in CI on the Node 24 leg and locally with `npm run test:e2e`:

1. The village loads with 1,250 gold, 900 timber and 750 food, and the map region takes keyboard focus.
2. Choosing Grow the village and starting development produces a `Claimed …` entry in the village log within 20 seconds.
3. Research → Compare → Try a sample agent report ends with "Agent report verified" in the browser.
4. A second tab shows "Your village is open in another tab" and loads the village after the first tab closes and Retry is pressed.
5. The home, Council and Research views match committed screenshot baselines (`tests/e2e/visual.spec.ts-snapshots/`, Linux baselines captured from CI, macOS baselines captured locally) with at most 0.1% differing pixels.

## Post-review fix

The whole-series review found that #15 had left an unterminated comment at the top of `components/game/council.css`: the deletion tool removed the `.village-life` selector but not the comment that introduced it, so the comment ran on until the next one 1,100 lines later and the production bundle dropped every Council rule, including the map residents' `.sim-resident` positioning. The home screenshot baseline did not catch it because seven missing 40×49 sprites were under the 1% threshold of a full-page capture.

The fix pull request re-derived the CSS deletions from the pre-#15 files with a tool that removes whole rule spans only, added `tests/stylesheets.test.mjs` (fails on a comment that swallows another comment, on unbalanced braces, and on unterminated strings; it failed on the broken file and passes after), tightened the screenshot threshold to 0.1%, and added Council and Research baselines. `.council-dialog` rules in the built CSS: 0 before the fix, 11 after.

## Repository settings

- Labels created from `.github/labels.yml` with `node scripts/sync-labels.mjs`; Discussions enabled.
- Dependabot: weekly npm (minor and patch grouped) and GitHub Actions updates.
- `main` ruleset: pull request required (no review count), status check `verify (24)` required, linear history, no force pushes, no deletions, no bypass actors. Link: https://github.com/Lingikaushikreddy/Settlement-Village/settings/rules
- Releases: pushing a `v*` tag runs the full verification and publishes a GitHub Release from the matching `CHANGELOG.md` section.

## Limits

This cleanup changed no gameplay, engine or report behavior. The browser suite covers Chromium only and seven checks; the screenshot baselines cover the home, Council and Research views at their initial state only. Styling consolidation, state management and performance work are the next sub-project.
