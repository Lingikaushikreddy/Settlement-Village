# Hosted playable demo — design

Date: 2026-09-30 · Roadmap item: Priority 5, "Hosted demonstration"

> **Revision (2026-09-30): the owner chose Vercel over Cloudflare Workers.** Standard `next build` compiles the app without code changes, so Vercel builds it natively. Vercel's Git integration replaces the planned `deploy.yml`, and `production-smoke.yml` runs the smoke test on each successful production `deployment_status`. Headers are set in `next.config.ts`; the preview image uses Next's `app/opengraph-image.jpg` convention, with `metadataBase` taken from `VERCEL_PROJECT_PRODUCTION_URL`. The vinext/Cloudflare build is kept as `build:cloudflare`. Sections below that mention Wrangler, Workers secrets or `_headers` describe the superseded plan.

## Goal

Anyone with a link can play Settlement in a browser over HTTPS, without cloning, installing Node or creating an account. A recruiter, player or contributor should reach a working village within one click from the README or a shared link.

Success means:

- A public HTTPS URL serves the free game. Building, crew objectives, battles, Council and in-browser Research (Compare, replay, report import/export) work there.
- Every push to `main` that passes CI deploys automatically; a failed smoke test against the live URL fails the workflow.
- A link pasted into LinkedIn, Discord, Slack or X renders a preview card with the village screenshot.
- The README and repository homepage point to the live game, and the release docs record the verified deployment instead of saying none exists.

## Decisions already made

- **Runtime: Cloudflare Workers (free tier).** `npm run build` already emits a self-contained Worker (`dist/server/wrangler.json`, `main: index.js`, assets in `dist/client`) with no D1, R2, KV or other bindings. Vercel and GitHub Pages were rejected: Vercel would require replacing the vinext/Cloudflare build, and Pages cannot serve the RSC routes (`/lab` redirects server-side) or set security headers.
- **No new backend.** Campaign saves stay browser-local (Web Locks needs HTTPS, which Workers provides). The research worker and Claude experiments remain local-only.

## Out of scope

Accounts, cloud saves, hosted research worker, hosted model calls, analytics, custom domain, multiplayer. The roadmap requires defining persistence and operating cost before any of these.

## Components

### 1. Deploy workflow — `.github/workflows/deploy.yml`

- Trigger: `workflow_run` on the `CI` workflow completing on `main` with `conclusion == success`, plus `workflow_dispatch`. Deploy never runs on pull requests or `codex/**` branches.
- Steps: checkout the commit CI verified (`workflow_run.head_sha`), set up Node from `.nvmrc`, `npm ci`, `npm run build`, then `npx wrangler deploy --config dist/server/wrangler.json`, then `node scripts/smoke-hosted.mjs "$SITE_URL"`.
- Secrets: `CLOUDFLARE_API_TOKEN` (scoped to "Edit Cloudflare Workers" on one account) and `CLOUDFLARE_ACCOUNT_ID`. Repository variable `SITE_URL` holds the public URL.
- Permissions: `contents: read` only. Actions pinned by commit SHA, matching `ci.yml`. `concurrency: deploy-production`, without cancelling an in-progress deploy.
- The Worker name stays `settlement`, so the default URL is `https://settlement.<account-subdomain>.workers.dev`.
- Missing secrets: the deploy step fails with a message naming the missing secret. It does not pass silently.

### 2. Smoke test — `scripts/smoke-hosted.mjs`

Plain Node `fetch`, no dependencies. Given a base URL, it checks:

1. `GET /` returns 200, `content-type` text/html, and the body contains the page title "Settlement".
2. Every `/_next/static/...` script and stylesheet referenced in that HTML returns 200.
3. `/game/terrain.png` and `/game/sprites.png` return 200 with an image content type.
4. `GET /lab?seed=7` redirects to `/?view=research&seed=7`.
5. The security headers from section 4 are present on `/`.

It exits non-zero and prints each failing check. A unit test runs its parsing and assertion logic against a local fixture HTML string, without network access, as part of `npm test`.

### 3. Hosted-mode notice in Research

`components/observatory.tsx` already hides the "Create on local worker" button and model controls unless the page is served from localhost and the worker's health check passes. Add one short notice, shown only when `workerOrigin()` is false, near the existing "Free policies are active…" text:

> You're playing the hosted demo. Free simulations, comparisons and replays run here in your browser. Live-model experiments need the optional local worker — see Run locally.

"Run locally" links to the README section on GitHub. No other Research behavior changes.

### 4. Metadata and security headers

- `app/layout.tsx`:
  - Remove the leftover `other: { "codex-preview": "development" }` meta tag.
  - Add `metadataBase` from a single exported constant `SITE_URL` in `lib/site.ts`, set once the account subdomain is known.
  - Add `openGraph` (title, description, `type: "website"`, image `/og.png` 1200×630) and `twitter` (`summary_large_image`).
- `public/og.png`: a 1200×630 crop of `docs/media/village.png` with the game title. It should be under 300 KB.
- `next.config.ts` `headers()` for all routes (vinext reads this):
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:8787; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `'unsafe-inline'` for scripts is required because RSC streaming injects inline bootstrap scripts. Nonces are a later hardening step, not part of this increment. `connect-src` keeps the localhost worker reachable for local users.
- The policy must not break the game: implementation verifies in a real browser, local `npm start` and the live URL, with zero CSP violations in the console across village, battle, Council and Research views.
- If vinext's `headers()` does not cover a response the smoke test checks, the fallback is a `public/_headers` entry. It must be merged with the `_headers` file vinext generates for `/_next/static/*` caching, not replace it.

### 5. README, repository and release docs

- README: a "▶ Play in your browser" badge and link above the screenshot, and one sentence in "Run locally" saying the hosted demo needs no install, while research worker and model experiments need a local clone.
- Replace "This repository contains the full local application. A public repository is not a hosted game server…" with an accurate description of the hosted demo and its limits.
- `gh repo edit --homepage <SITE_URL>`.
- `docs/public-release-verification.md`: add a dated "Hosted demo" section recording the URL, deployed commit, smoke-test output and browsers checked. Leave the September 17 statement as a historical record.
- `SECURITY.md`: note that the hosted demo has no server-side state or credentials, and list the headers.
- `CHANGELOG.md`: a `0.3.0` entry. Bump `package.json` to `0.3.0`.

## Data flow

Push to `main` → CI passes → deploy workflow builds the same commit → Wrangler uploads the Worker and `dist/client` assets → the smoke test checks the live URL. Visitors' browsers fetch HTML from the Worker and static assets from Workers Assets, and keep all game state in their own local storage.

## Error handling

- Deploy or smoke failure: the workflow fails and the previous Worker version stays live (Wrangler deploys atomically). Rollback is `wrangler rollback` or re-running deploy on an earlier commit.
- Browsers without Web Locks or storage: the existing save-ownership messaging applies unchanged.
- The worker probe on the hosted site isn't attempted (`workerOrigin()` is false), so the hosted site makes no requests to localhost.

## Testing

- `npm test`: the new smoke-test unit test, plus all existing tests.
- Existing CI steps unchanged: integration, evaluation verification, typecheck, lint and build.
- Before the first deploy: run `npm run build && npm start`, then `node scripts/smoke-hosted.mjs http://127.0.0.1:5173`. Manually play each view in Chrome with the console open to check for CSP violations.
- After deploy: the smoke test against the live URL, a manual play-through on desktop Chrome and a phone-width viewport, and the link-preview card checked with a real share or a preview debugger.

## Requires from the owner

A Cloudflare account; an API token with Workers edit permission; the two GitHub secrets and the `SITE_URL` variable. The first `wrangler deploy` can be run locally after `wrangler login` to learn the workers.dev subdomain before `SITE_URL` is fixed.
