# Foundation cleanup design

**Date:** 2026-10-09 · **Status:** approved 2026-10-09 · **Owner:** Kaushik Reddy

Settlement is being prepared for serious open-source contribution. This is the first of four sub-projects (foundation cleanup, testbed as a product, UI architecture, game and research content). It removes everything in the repository that is not part of the shipped product, closes the open security advisories, adds the governance a contributor expects, and puts a browser-level safety net under the interface before any larger change lands.

## Goals

- One build system. The repository builds, runs and deploys with Next.js only.
- Every dependency in `package.json` is imported by shipped code or tooling that CI runs.
- `npm audit --omit=dev` reports no advisories at the time of merge.
- CI proves the declared Node range (`>=22.13`) on Node 22, 24 and 26.
- A contributor can find the code of conduct, owners, labels, a discussion board and a "first PR" path without asking.
- Direct pushes to `main` are impossible; every change passes CI in a pull request.
- A Playwright smoke suite exercises the four flows that define the product and catches a blank page or a broken save gate.
- Releases are produced by a workflow from a tag, with notes taken from the changelog.

## Non-goals

- No behavior change in `lib/game`, `lib/sim`, `lib/testbed`, `lib/agent` or `worker/`. `docs/evaluation-results.json` and `public/examples/agent-report.json` must verify unchanged at the end of every pull request.
- No UI restructuring, no state store, no memoization work, no asset format changes. Those belong to the UI architecture sub-project.
- No new game content, scenarios or testbed features.
- No change to the Vercel project settings beyond what the repository already declares.

If a deletion turns out to require an engine or UI behavior change, stop and raise it instead of folding it in.

## Design

### 1. Remove the second build system

The repository was scaffolded from the OpenAI "Sites" starter, which brought a vinext/Vite/Cloudflare Workers build, a ChatGPT auth helper, Drizzle/D1 stubs and a set of install scripts. None of it is exercised: `app/chatgpt-auth.ts` has no importers, CI never runs the Cloudflare build, and Vercel is the hosted path.

Delete these files and directories:

```
app/chatgpt-auth.ts
.openai/
build/
db/
drizzle/
drizzle.config.ts
cloudflare-env.d.ts
examples/d1/
vite.config.ts
scripts/build-verified.sh
scripts/execution-profile.mjs
scripts/install-ci.mjs
scripts/install-ci.sh
scripts/install-pnpm.sh
scripts/pnpm-install.mjs
scripts/run-framework.mjs
scripts/sites-env.mjs
scripts/sites-env.sh
```

Remove the `install:ci`, `dev:cloudflare`, `build:cloudflare`, `start:cloudflare` and `db:generate` scripts. Rewrite `scripts/dev-all.mjs` so the second child is `next dev --port 5173` (via `node_modules/next/dist/bin/next`) instead of `run-framework.mjs`.

Remove these dependencies: `vinext`, `vite`, `@vitejs/plugin-react`, `@vitejs/plugin-rsc`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `wrangler`, `drizzle-orm`, `drizzle-kit`, `react-server-dom-webpack`, the `overrides.miniflare` block, `recharts`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `embla-carousel-react`, `vaul`, `input-otp`, `react-day-picker`, `sonner`, `next-themes`, `cmdk`, `@base-ui/react`, `@shadcn/react`, `react-resizable-panels`.

Keep: `next`, `react`, `react-dom`, `zod`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` (the kept dialog and select components use its utility classes), `typescript`, `eslint`, `eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom`. `vendor/shadcn-tailwind-4.13.0.css` stays; `app/globals.css` imports it.

Collateral edits: drop `@cloudflare/workers-types` from `tsconfig.json` `types`; remove the `WRANGLER_SEND_METRICS`, `CLOUDFLARE_CF_FETCH_ENABLED` and `SHARP_IGNORE_GLOBAL_LIBVIPS` env lines from `ci.yml`; remove `/.vinext/`, `/dist/`, `/.wrangler/`, `/.sites-runtime/`, `/.agents/`, `/.codex/`, `/outputs/` from `.gitignore`; remove the sites-plugin bullet from `THIRD_PARTY_NOTICES.md`; remove the "alternative vinext/Cloudflare runtime" sentence from the README "Run locally" section and the "alternative vinext/Cloudflare build" phrase from its stack line and from `docs/player-guide.md`. The `.wrangler/` and `.superpowers/` directories on disk are untracked and are left alone.

`package-lock.json` is regenerated with `npm install` and the result must install cleanly with `npm ci`.

### 2. Dead interface code

The audit found code that nothing renders. Delete:

- `components/village-map.tsx` and the `map-`, `village-svg` and `place-label` rules in `app/globals.css` that only it used.
- The `VillageLife` component in `components/game/council.tsx` and the `.village-life` and `.life-*` rules in `components/game/council.css`.
- `hooks/use-mobile.ts` (used only by the deleted sidebar).
- `public/file.svg`, `public/globe.svg`, `public/window.svg` (create-next-app leftovers).
- 56 of the 61 files in `components/ui/`. Keep `button.tsx`, `dialog.tsx`, `select.tsx`, `slider.tsx`, `tabs.tsx`.
- The orphaned class rules the audit listed: 15 in `globals.css` (`about-button`, `brand-icon`, `breadcrumb`, `map-panel`, `mode-badge`, `nav-active`, `resident-picker`, `workspace-heading` and the rest of the topbar era), 10 in `game.css` (`quest-panel`, `quest-item`, `wandering-villager`, `wander-0..2`, `resource-fill`, …), 4 `experiment-*` rules in `research.css`, and `quest-panel` / `resident-face` in `council.css`.

Rule for every CSS deletion: grep the class name across `app/`, `components/` and `lib/` first and delete only when there are zero hits. The eslint override block for `components/ui/**` stays for the five remaining files; its `hooks/use-mobile.ts` entry goes.

Visual regression is guarded by the screenshot baseline in section 5: the home screenshot taken before this change must match the one taken after it.

### 3. Security and runtime

- Bump `next` and `eslint-config-next` to 16.4.0, which closes the critical advisory (`next/og` RCE and `use cache` leak). Settlement does not use `ImageResponse`, so the upgrade is defensive, but the advisory must not sit in the audit output.
- Run `npm audit fix` for `sharp`, `source-map-js`, `fast-uri` and `baseline-browser-mapping`; confirm `npm audit --omit=dev` is clean.
- Change the CI job to a matrix over Node `22`, `24` and `26`. Node 24 remains the `.nvmrc` default and the one whose artifacts are used for the smoke step. The CI job is named `verify` with the matrix value appended by GitHub, so the Node 24 leg appears as `verify (24)`; that is the status check the branch ruleset requires, so a Node 26 regression fails the workflow but a flaky newer runtime cannot block merging without a conscious decision.
- Fix the integration test that fails on Node 26. `tests/http.integration.mjs` reads one chunk from the SSE stream and expects a `data:` line, but Node 26 delivers the `retry: 1500` preamble as its own chunk. The test will read chunks until it sees `data:` or has read eight chunks, then fail. The worker is unchanged.

### 4. Governance

Add:

- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1, contact address taken from the repository owner's public GitHub email.
- `.github/CODEOWNERS`: `* @Lingikaushikreddy`.
- `.github/dependabot.yml`: weekly `npm` updates grouped as `minor-and-patch`, major updates individually; weekly `github-actions` updates. Dependabot pull requests run CI like any other.
- `.github/labels.yml` plus `scripts/sync-labels.mjs` (uses `gh label create --force`): `good first issue`, `help wanted`, `bug`, `enhancement`, `documentation`, and `area: engine`, `area: game`, `area: testbed`, `area: ui`, `area: docs`, `area: infra`. The script is run once by the maintainer; it is not part of CI.
- GitHub Discussions enabled with Q&A, Ideas and Show and tell categories (done through `gh api`, recorded in the plan as a manual step).
- A `main` ruleset created with `gh api repos/{owner}/{repo}/rulesets`: pull request required with zero required approvals, required status check `verify (24)` from the CI workflow (the job's `name` field is removed so GitHub uses the job id), linear history, no force pushes, no deletion, bypass list empty so it applies to the owner too. The ruleset is applied after the last pull request of this sub-project merges, so the sequence itself is not blocked by it.
- `CONTRIBUTING.md` gains a "Your first pull request" section: pick a `good first issue`, ask in Discussions, run the verification block, open the PR with the template. The README gains a Discussions link beside the existing Contribute link.

### 5. Browser smoke tests

Add `@playwright/test` as a devDependency with Chromium only. Configuration in `playwright.config.ts`: `baseURL` from `SETTLEMENT_E2E_URL` defaulting to `http://127.0.0.1:5173`, `webServer` runs `npm start` when the URL is the default, retries 1 in CI, trace on first retry, screenshots on failure. Tests live in `tests/e2e/`. Four tests, intended to finish in under two minutes:

1. **The village loads.** The HUD shows the starting treasury (1,250 gold, 900 timber, 750 food) and the map region is focusable.
2. **Development starts.** Choose Village orders → Grow the village → Start village development; within 10 seconds the village log shows a `claim` event and the development panel shows at least one step as ready, building or waiting.
3. **Report verification in the browser.** Open `/?view=research`, Compare, Import & verify with `public/examples/agent-report.json`; the page reports every case verified.
4. **Second tab is blocked.** Open a second page in the same context; it shows the blocked-session screen and offers the retry control. Closing the first page and retrying loads the village.

A fifth test takes a full-page screenshot of the home view with animations disabled and compares it to a committed baseline under `tests/e2e/__screenshots__/` using Playwright's `toHaveScreenshot` with `maxDiffPixelRatio: 0.01`. The baseline is captured on `main` before the dead-code pull request and must still pass after it.

CI runs `npm run test:e2e` on the Node 24 leg after `npm run build`, reusing the production server already started for the hosted smoke check. Playwright's browser install is cached with `actions/cache` keyed on the Playwright version. Traces and screenshots upload as artifacts on failure.

### 6. Release automation and v0.6.0

- `.github/workflows/release.yml` triggers on tags matching `v*`. It checks out the tag, installs with Node 24, runs the same verification steps as CI, extracts the section of `CHANGELOG.md` whose heading starts with the tag's version, and creates a GitHub Release with that text through `gh release create`. The release is marked as latest. Permissions: `contents: write` only.
- `CHANGELOG.md` gains a `0.6.0` entry describing the removal of the alternative build, the dependency pruning, the security bumps, the Node matrix, the e2e suite, the governance files and the branch protection. It states that gameplay, reports and saves are unchanged.
- `package.json` version becomes `0.6.0`. The maintainer pushes the tag after the final merge; the workflow does the rest.

## Pull request sequence

Each pull request must pass: `npm test`, `npm run test:integration`, `npm run evaluate -- --verify docs/evaluation-results.json`, `npm run eval:agent -- --verify public/examples/agent-report.json`, `npm run typecheck`, `npm run lint`, `npm run build`, and (from PR 5 onward) `npm run test:e2e`.

| # | Branch | Content | Depends on |
| - | ------ | ------- | ---------- |
| 0 | `chore/foundation-cleanup-docs` | This spec and its implementation plan | — |
| 1 | `chore/remove-sites-scaffolding` | Section 1 | 0 |
| 2 | `chore/security-and-node-matrix` | Section 3 | 1 |
| 3 | `test/playwright-smoke` | Section 5 | 1 |
| 4 | `chore/remove-dead-ui` | Section 2 | 3 (its screenshot baseline) |
| 5 | `chore/governance` | Section 4 files and CONTRIBUTING | 1 |
| 6 | `chore/release-0.6.0` | Section 6, then apply the ruleset after merge | all |

PRs 3 and 5 are independent of each other once PR 1 has merged; PR 4 waits for PR 3 because it relies on the committed screenshot baseline.

## Verification record

Completion of this sub-project is recorded in `docs/foundation-cleanup-verification.md`, in the same style as `docs/village-v5-verification.md`: the commands run, their results, the Node versions, the before/after dependency count, the audit output, the screenshot comparison result and a link to the ruleset.

## Risks

- **Lockfile churn.** Removing 25 packages rewrites most of `package-lock.json`. Mitigation: PR 1 contains nothing else, so its review is "does `npm ci && npm run build` still pass".
- **A kept shadcn component imports something deleted.** Mitigation: `npm run typecheck` and `npm run build` fail the PR; the dependency list above was derived from the actual imports of the five kept files.
- **Playwright timing on CI.** Mitigation: generous but bounded timeouts, one retry, and a trace artifact to inspect.
- **Ruleset locks the owner out of an emergency fix.** Mitigation: the owner can edit the ruleset in the repository settings; CI must still pass through a pull request, which is the intended guarantee.
