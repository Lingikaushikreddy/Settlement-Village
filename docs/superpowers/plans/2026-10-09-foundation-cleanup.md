# Foundation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Settlement to one build system and its real dependencies, close the open security advisories, add contributor governance, a Playwright smoke suite and release automation, and ship v0.6.0 with gameplay and reports unchanged.

**Architecture:** Six focused pull requests on top of `main`. Deletions land first (scaffolding, then dead UI), so every later PR is reviewed against a clean tree. CI widens to a Node matrix and gains a browser smoke job; governance is files plus a GitHub ruleset applied after the last merge. No file under `lib/` or `worker/` changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Node 22/24/26, `node --test`, Playwright (Chromium), GitHub Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-09-foundation-cleanup-design.md`

## Global Constraints

- No behavior change in `lib/game`, `lib/sim`, `lib/testbed`, `lib/agent`, `worker/`. If a task seems to need one, stop and report.
- `npm run evaluate -- --verify docs/evaluation-results.json` and `npm run eval:agent -- --verify public/examples/agent-report.json` must pass unchanged in every PR.
- Every PR passes: `npm test`, `npm run test:integration`, both verifications above, `npm run typecheck`, `npm run lint`, `npm run build`; from Task 6 onward also `npm run test:e2e`.
- Node range stays `>=22.13.0`; `.nvmrc` stays `24`.
- Kept runtime deps: `next`, `react`, `react-dom`, `zod`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. Kept dev deps: `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `typescript`, `eslint`, `eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom`, plus `@playwright/test` from Task 6.
- Kept `components/ui` files: `button.tsx`, `dialog.tsx`, `select.tsx`, `slider.tsx`, `tabs.tsx`.
- Commits and PRs are authored as Lingikaushikreddy with no AI attribution trailer or line.
- Branch names and order follow the spec table: docs → remove-sites-scaffolding → security-and-node-matrix → playwright-smoke → remove-dead-ui → governance → release-0.6.0. (Playwright moves ahead of dead-UI so the screenshot baseline exists first.)

## Review Focus

1. **`npm ci` on a fresh clone after Task 2.** A stale `package-lock.json` entry for a removed package makes `npm ci` fail even though `npm install` worked. Task 2 step 7 runs `rm -rf node_modules && npm ci` to pin this.
2. **`npm run dev:all` after Task 2.** The rewritten script must start both the worker and Next; a wrong binary path fails silently in the child. Task 2 step 5 starts it and curls both ports.
3. **Second-tab blocking on a real browser.** The unit test uses fakes; only Playwright proves the Web Locks path in Chromium. Task 6 test 4 covers it.
4. **Integration test on Node 26 reading a split SSE preamble.** Task 3 step 3 runs the fixed test under Node 26 explicitly, not just Node 24.
5. **Release workflow extracting the wrong changelog section.** An awk range that matches `## 0.6.0` must stop at the next `## ` heading, otherwise the release note includes 0.5.0. Task 8 step 3 runs the extraction locally against `CHANGELOG.md` and asserts the output ends before `## 0.5.0`.

---

### Task 1: Open the docs pull request

**Files:**
- Already committed on `chore/foundation-cleanup-docs`: the spec and this plan.

- [ ] **Step 1: Push and open PR 0**

```bash
git push -u origin chore/foundation-cleanup-docs
gh pr create --base main --title "docs: foundation cleanup spec and plan" \
  --body "Design and implementation plan for the foundation cleanup sub-project (first of four). No code changes. See docs/superpowers/specs/2026-10-09-foundation-cleanup-design.md."
```

- [ ] **Step 2: Wait for CI, merge, return to main**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
git checkout main && git pull
```

Expected: CI green (docs-only change still runs the full job).

---

### Task 2: Remove the OpenAI Sites and Cloudflare scaffolding

**Files:**
- Delete: `app/chatgpt-auth.ts`, `.openai/hosting.json`, `build/sites-vite-plugin.ts`, `build/sites-vite-plugin.LICENSE`, `db/index.ts`, `db/schema.ts`, `drizzle/meta/_journal.json`, `drizzle.config.ts`, `cloudflare-env.d.ts`, `examples/d1/app/api/notes/route.ts`, `examples/d1/db/schema.ts`, `vite.config.ts`, `scripts/build-verified.sh`, `scripts/execution-profile.mjs`, `scripts/install-ci.mjs`, `scripts/install-ci.sh`, `scripts/install-pnpm.sh`, `scripts/pnpm-install.mjs`, `scripts/run-framework.mjs`, `scripts/sites-env.mjs`, `scripts/sites-env.sh`
- Modify: `package.json`, `package-lock.json` (regenerated), `scripts/dev-all.mjs`, `tsconfig.json:30-34`, `.github/workflows/ci.yml:22-26`, `.gitignore`, `THIRD_PARTY_NOTICES.md`, `README.md:88,143`, `docs/player-guide.md:127`

**Interfaces:**
- Produces: a `package.json` whose `dependencies` are exactly the nine kept runtime deps and whose `devDependencies` are the nine kept dev deps. Later tasks add `@playwright/test` only.

- [ ] **Step 1: Branch and delete the files**

```bash
git checkout -b chore/remove-sites-scaffolding main
git rm -r app/chatgpt-auth.ts .openai build db drizzle drizzle.config.ts cloudflare-env.d.ts examples/d1 vite.config.ts \
  scripts/build-verified.sh scripts/execution-profile.mjs scripts/install-ci.mjs scripts/install-ci.sh \
  scripts/install-pnpm.sh scripts/pnpm-install.mjs scripts/run-framework.mjs scripts/sites-env.mjs scripts/sites-env.sh
```

- [ ] **Step 2: Rewrite `scripts/dev-all.mjs`**

Replace the whole file with:

```js
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Start the optional research worker and the Next.js dev server together.
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const children = [
  spawn(process.execPath, ["--experimental-strip-types", "worker/server.ts"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, [next, "dev", "--port", "5173"], { stdio: "inherit" }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  });
```

- [ ] **Step 3: Edit `package.json`**

Remove the scripts `install:ci`, `dev:cloudflare`, `build:cloudflare`, `start:cloudflare`, `db:generate`. Remove the `overrides` block. Set `dependencies` and `devDependencies` to exactly:

```json
  "dependencies": {
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lucide-react": "^1.31.0",
    "next": "16.3.4",
    "radix-ui": "^1.6.7",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "tailwind-merge": "3.6.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.2.1",
    "@types/node": "22.19.19",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "eslint": "9.39.4",
    "eslint-config-next": "16.3.4",
    "tailwindcss": "4.2.1",
    "tw-animate-css": "^1.4.0",
    "typescript": "5.9.3"
  },
```

Also drop `"vite"` from the `keywords` array if present (it is).

- [ ] **Step 4: Collateral config edits**

`tsconfig.json`: change `"types": ["node", "@cloudflare/workers-types"]` to `"types": ["node"]`.

`.github/workflows/ci.yml`: delete the three lines `WRANGLER_SEND_METRICS: "false"`, `CLOUDFLARE_CF_FETCH_ENABLED: "false"`, `SHARP_IGNORE_GLOBAL_LIBVIPS: "1"`. Keep `SETTLEMENT_LIVE_AI: "false"`.

`.gitignore`: delete the lines `/.vinext/`, `/dist/`, `/.wrangler/`, `/.sites-runtime/`, `/.agents/`, `/.codex/`, `/outputs/` and the comment line above them (`# Checkout-local execution profile and tool state; never publish them.`). Keep `/work/`.

`THIRD_PARTY_NOTICES.md`: delete the bullet beginning `` - `build/sites-vite-plugin.ts` ``.

`README.md`: delete the paragraph that begins `The alternative vinext/Cloudflare runtime remains available` but keep its last sentence about `npm run smoke -- <url>` as its own paragraph. In the stack line, change `**TypeScript · React · Next.js · Zod · Tailwind CSS · optional Node.js/SQLite worker · alternative vinext/Cloudflare build**` to `**TypeScript · React · Next.js · Zod · Tailwind CSS · optional Node.js/SQLite worker**`.

`docs/player-guide.md`: in the paragraph at line 127, delete the sentence `Standard Next.js is the default application runtime; the alternative vinext/Cloudflare scripts remain available.` and replace it with `The application runs on Next.js.`

- [ ] **Step 5: Regenerate the lockfile and verify the dev script**

```bash
rm -rf node_modules package-lock.json
npm install
npm ls --depth=0 2>&1 | grep -ci "extraneous\|missing"   # expect 0
```

Then start `npm run dev:all` in the background, wait, and check both ports:

```bash
npm run dev:all > /tmp/devall.log 2>&1 &
sleep 12
curl -sf http://127.0.0.1:8787/health && curl -sf -o /dev/null http://127.0.0.1:5173/ && echo BOTH_UP
kill %1
```

Expected: `{"ok":true,...}` then `BOTH_UP`. If port 5173 or 8787 is taken on this Mac, stop the other process first (see the port-conflict note in memory).

- [ ] **Step 6: Grep for leftovers**

```bash
grep -rn "cloudflare\|wrangler\|vinext\|drizzle\|chatgpt\|sites-vite\|execution-profile\|run-framework" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=docs/superpowers . | grep -v package-lock
```

Expected: no output.

- [ ] **Step 7: Full verification from a clean install**

```bash
rm -rf node_modules && npm ci
npm test && npm run test:integration && npm run evaluate -- --verify docs/evaluation-results.json \
  && npm run eval:agent -- --verify public/examples/agent-report.json && npm run typecheck && npm run lint && npm run build
```

Expected: all pass. (`test:integration` may fail on Node 26 before Task 3; run it with `nvm use 24` if so and note it in the PR.)

- [ ] **Step 8: Commit and open PR 1**

```bash
git add -A
git commit -m "chore: remove the OpenAI Sites and Cloudflare scaffolding

Settlement builds and deploys with Next.js only. Delete the vinext/Vite/
Workers build, the ChatGPT auth helper, the Drizzle/D1 stubs and the
starter install scripts, and prune 25 dependencies nothing imports."
git push -u origin chore/remove-sites-scaffolding
gh pr create --base main --title "chore: remove the OpenAI Sites and Cloudflare scaffolding" --body-file - <<'EOF'
## What changes for the player or researcher?

Nothing visible. The repository now has one build system (Next.js). The unused vinext/Cloudflare Workers build, the ChatGPT auth helper, the Drizzle/D1 stubs and the starter install scripts are gone, along with 25 dependencies that no shipped code imported. `npm run dev:all` now starts the worker and `next dev` directly.

## Verification

- `rm -rf node_modules && npm ci` then the full verification block: tests, integration, both report verifications, typecheck, lint, build.
- `npm run dev:all` serves 127.0.0.1:8787/health and 127.0.0.1:5173.
- `grep` for cloudflare/wrangler/vinext/drizzle/chatgpt returns nothing outside docs/superpowers history.

## Limits or follow-up

Part 1 of the foundation cleanup (spec: docs/superpowers/specs/2026-10-09-foundation-cleanup-design.md). Security bumps and the Node matrix follow in the next PR.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 3: Security bumps, Node matrix and the Node 26 integration fix

**Files:**
- Modify: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `tests/http.integration.mjs:101-105`

**Interfaces:**
- Produces: a CI job with id `verify` and matrix `node: [22, 24, 26]`, so the status check for the ruleset in Task 8 is named `verify (24)`.

- [ ] **Step 1: Write the failing check for the SSE read (it already fails on Node 26)**

```bash
git checkout -b chore/security-and-node-matrix main
node --version   # must print v26.x for this step; use `nvm use 26` or the system node
npm run test:integration
```

Expected: FAIL with `actual: 'retry: 1500\n\n'`, `expected: /data:/`.

- [ ] **Step 2: Fix the test to read until a data line**

In `tests/http.integration.mjs`, replace:

```js
    const reader = response.body.getReader();
    const chunk = await reader.read();
    assert.match(new TextDecoder().decode(chunk.value), /data:/);
    await reader.cancel();
```

with:

```js
    // Node 26 delivers the "retry:" preamble as its own chunk, so read until
    // the first event arrives. Eight chunks is far more than one event needs.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = "";
    for (let i = 0; i < 8 && !/data:/.test(received); i++) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value, { stream: true });
    }
    assert.match(received, /data:/);
    await reader.cancel();
```

- [ ] **Step 3: Run it on Node 26 and Node 24**

```bash
npm run test:integration            # Node 26
nvm use 24 && npm run test:integration && nvm use 26
```

Expected: PASS on both.

- [ ] **Step 4: Bump Next and fix the audit**

```bash
npm install next@16.4.0 eslint-config-next@16.4.0
npm audit fix
npm audit --omit=dev
```

Expected: the last command prints `found 0 vulnerabilities`. If `npm audit fix` leaves anything, inspect it with `npm audit --json` and bump the offending package explicitly; do not use `--force`.

- [ ] **Step 5: Convert CI to a matrix**

Replace the `jobs:` section of `.github/workflows/ci.yml` with:

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
    env:
      SETTLEMENT_LIVE_AI: "false"
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
      - run: npm run evaluate -- --verify docs/evaluation-results.json
      - run: npm run eval:agent -- --verify public/examples/agent-report.json
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - name: Smoke test the production server
        if: matrix.node == 24
        run: |
          npm start > next-start.log 2>&1 &
          for i in $(seq 1 30); do
            curl -sf -o /dev/null http://127.0.0.1:5173/ && break
            sleep 1
          done
          npm run smoke -- http://127.0.0.1:5173 || { cat next-start.log; exit 1; }
```

Note the job has no `name:` field, so GitHub names the legs `verify (22)`, `verify (24)`, `verify (26)`.

- [ ] **Step 6: Full verification, commit, PR 2**

```bash
npm test && npm run test:integration && npm run evaluate -- --verify docs/evaluation-results.json \
  && npm run eval:agent -- --verify public/examples/agent-report.json && npm run typecheck && npm run lint && npm run build
git add -A
git commit -m "chore: close security advisories and test Node 22, 24 and 26 in CI

Bump Next to 16.4.0, apply the remaining audit fixes, run the CI job as a
Node matrix, and make the worker SSE test tolerate the split preamble
that Node 26 delivers."
git push -u origin chore/security-and-node-matrix
gh pr create --base main --title "chore: close security advisories and test Node 22, 24 and 26 in CI" --body-file - <<'EOF'
## What changes for the player or researcher?

Nothing visible. Next moves to 16.4.0 (closes the critical next/og advisory), `npm audit --omit=dev` is clean, CI now runs on Node 22, 24 and 26, and the worker integration test passes on Node 26.

## Verification

- `npm audit --omit=dev` → 0 vulnerabilities.
- `npm run test:integration` on Node 24 and Node 26 locally.
- Full verification block on Node 26; CI matrix green on all three legs.

## Limits or follow-up

The smoke step runs only on the Node 24 leg to keep the matrix under the 20-minute budget. Part 2 of the foundation cleanup.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 4: Playwright smoke suite

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/village.spec.ts`, `tests/e2e/research.spec.ts`, `tests/e2e/session.spec.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/__screenshots__/` (generated baseline)
- Modify: `package.json` (devDependency, `test:e2e` script), `.gitignore` (Playwright outputs), `.github/workflows/ci.yml` (e2e step), `CONTRIBUTING.md` (verification block), `README.md` (verification block)

**Interfaces:**
- Produces: `npm run test:e2e` which runs against `SETTLEMENT_E2E_URL` or starts `npm start` itself. Task 5 depends on the committed baseline from `visual.spec.ts`.

- [ ] **Step 1: Install Playwright**

```bash
git checkout -b test/playwright-smoke main
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`. Add to `.gitignore`:

```
# playwright
/test-results/
/playwright-report/
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SETTLEMENT_E2E_URL ?? "http://127.0.0.1:5173";
const external = !!process.env.SETTLEMENT_E2E_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: "npm start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
```

- [ ] **Step 3: Write the village tests**

`tests/e2e/village.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the village loads with its starting treasury", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  await expect(page.getByLabel("wood: 900")).toBeVisible();
  await expect(page.getByLabel("food: 750")).toBeVisible();
  const map = page.getByRole("region", { name: /Your village/ });
  await expect(map).toBeVisible();
  await map.focus();
  await expect(map).toBeFocused();
});

test("starting village development produces a crew claim", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Grow the village/ }).click();
  await expect(page.getByRole("dialog", { name: "Grow the village" })).toBeVisible();
  await page.getByRole("button", { name: "Start village development" }).click();
  await page.getByRole("button", { name: /View plan/ }).click();
  await page.getByRole("button", { name: "Village log" }).click();
  await expect(page.getByText(/Claimed /).first()).toBeVisible({ timeout: 20_000 });
});
```

- [ ] **Step 4: Write the research test**

`tests/e2e/research.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the sample agent report verifies in the browser", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: "Compare" }).click();
  await page.getByRole("button", { name: "Try a sample agent report" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Agent report verified" })).toBeVisible({
    timeout: 45_000,
  });
});
```

- [ ] **Step 5: Write the session test**

`tests/e2e/session.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a second tab is blocked until the first closes", async ({ context }) => {
  const first = await context.newPage();
  await first.goto("/");
  await expect(first.getByLabel("Village orders")).toBeVisible();

  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: "Your village is open in another tab" }),
  ).toBeVisible();

  await first.close();
  await second.getByRole("button", { name: "Retry after closing other tab" }).click();
  await expect(second.getByLabel("Village orders")).toBeVisible();
});
```

- [ ] **Step 6: Write the visual baseline test**

`tests/e2e/visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the home view matches its baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  // The crew board and HUD are static at tick 0; production bubbles are hidden by reduced motion.
  await expect(page).toHaveScreenshot("home.png", { fullPage: true, animations: "disabled" });
});
```

- [ ] **Step 7: Build, run, and capture the baseline**

```bash
npm run build
npx playwright test --update-snapshots tests/e2e/visual.spec.ts
npm run test:e2e
```

Expected: 5 passed. The baseline lands in `tests/e2e/visual.spec.ts-snapshots/home-chromium-linux.png` (Playwright's default folder; on macOS it is `-darwin.png`). Because CI runs Linux, generate the Linux baseline there: push the branch, download the `playwright-report` artifact from the failing first run, copy the actual image into the snapshots folder, commit it. Or run the capture through Docker: `docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v<version>-jammy npx playwright test --update-snapshots tests/e2e/visual.spec.ts` where `<version>` matches the installed `@playwright/test`.

- [ ] **Step 8: Add the CI step**

In `.github/workflows/ci.yml`, after the smoke step (same `if: matrix.node == 24`), add:

```yaml
      - name: Cache Playwright browsers
        if: matrix.node == 24
        uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - name: Install Chromium
        if: matrix.node == 24
        run: npx playwright install --with-deps chromium
      - name: Browser smoke tests
        if: matrix.node == 24
        run: npm run test:e2e
        env:
          SETTLEMENT_E2E_URL: http://127.0.0.1:5173
      - name: Upload Playwright report
        if: matrix.node == 24 && failure()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

The production server started by the smoke step is still running, so `SETTLEMENT_E2E_URL` points the suite at it.

- [ ] **Step 9: Document and commit**

Add `npm run test:e2e` to the verification code blocks in `README.md` (Verification section) and `CONTRIBUTING.md` (Make and verify a change), with one sentence: `The browser suite needs Chromium: run npx playwright install chromium once.`

```bash
git add -A
git commit -m "test: add a Playwright smoke suite for the village, research and session flows"
git push -u origin test/playwright-smoke
gh pr create --base main --title "test: Playwright smoke suite" --body-file - <<'EOF'
## What changes for the player or researcher?

Nothing visible. Five browser tests now run in CI on the Node 24 leg against the production build: the village loads with its treasury, starting Grow the village produces a crew claim, the sample agent report verifies in Research → Compare, a second tab is blocked until the first closes, and the home view matches a screenshot baseline.

## Verification

- `npm run build && npm run test:e2e` locally (Chromium).
- CI green with the new step; Playwright report uploads on failure.

## Limits or follow-up

Chromium only. The screenshot baseline is Linux-rendered and is the guard for the dead-UI removal in the next PR. Part 3 of the foundation cleanup.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 5: Remove dead interface code

**Files:**
- Delete: `components/village-map.tsx`, `hooks/use-mobile.ts`, `public/file.svg`, `public/globe.svg`, `public/window.svg`, 56 files in `components/ui/`
- Modify: `components/game/council.tsx:65-129` (remove `VillageLife`), `components/game/council.css`, `app/globals.css`, `components/game/game.css`, `components/game/research.css`, `eslint.config.mjs:191`

- [ ] **Step 1: Delete the unused ui files and leftovers**

```bash
git checkout -b chore/remove-dead-ui main
cd components/ui && ls | grep -vE '^(button|dialog|select|slider|tabs)\.tsx$' | xargs git rm -q && cd ../..
git rm components/village-map.tsx hooks/use-mobile.ts public/file.svg public/globe.svg public/window.svg
rmdir hooks 2>/dev/null || true
ls components/ui    # expect exactly: button.tsx dialog.tsx select.tsx slider.tsx tabs.tsx
```

- [ ] **Step 2: Remove `VillageLife` from council.tsx**

Open `components/game/council.tsx`. Delete the `VillageLife` function (it starts at the line `function VillageLife(` near line 65 and ends at the closing brace before the next top-level declaration near line 129). Remove any import that becomes unused as a result (run `npm run lint` to find them).

- [ ] **Step 3: Remove orphaned CSS, verified by grep**

For each candidate class, delete its rules only when this returns 0:

```bash
grep -rc "CLASSNAME" app components lib | awk -F: '{s+=$2} END {print s}'
```

Candidates, by file:

- `app/globals.css`: rules whose selectors start with `.map-`, `.village-svg`, `.place-label`, `.about-button`, `.brand-icon`, `.breadcrumb`, `.map-panel`, `.mode-badge`, `.nav-active`, `.resident-picker`, `.workspace-heading`.
- `components/game/council.css`: `.village-life`, `.life-*`, `.quest-panel`, `.resident-face`.
- `components/game/game.css`: `.quest-panel`, `.quest-item`, `.wandering-villager`, `.wander-0`, `.wander-1`, `.wander-2`, `.resource-fill`.
- `components/game/research.css`: selectors beginning `.experiment-`.

Run this list generator to find any further orphans in the same four files and treat them the same way:

```bash
for f in app/globals.css components/game/council.css components/game/game.css components/game/research.css; do
  grep -oE '^\.[a-zA-Z][a-zA-Z0-9_-]*' "$f" | sort -u | sed 's/^\.//' | while read c; do
    n=$(grep -rE "[\"' ]$c[\"' ]|\`$c|\\\$\\{.*\\}$c|$c \\$\\{" app components lib 2>/dev/null | wc -l)
    [ "$n" = 0 ] && echo "$f: .$c"
  done
done
```

Treat the output as candidates, not verdicts: classes built by template literals (for example `resource-pill ${r}`) show as unused by this grep. Keep any class whose name is a resource, troop, building, status or view value.

- [ ] **Step 4: Update the eslint override**

In `eslint.config.mjs`, change `files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"]` to `files: ["components/ui/**/*.{ts,tsx}"]`.

- [ ] **Step 5: Verify, including the screenshot baseline**

```bash
npm run typecheck && npm run lint && npm run build && npm test
npm run test:e2e
```

Expected: everything passes and `visual.spec.ts` matches the baseline committed in Task 4. If the screenshot differs, a deleted rule was live: restore it and re-run.

- [ ] **Step 6: Commit and PR 4**

```bash
git add -A
git commit -m "chore: remove dead interface code

Drop the unused SVG village map, VillageLife, the mobile hook, 56 unused
shadcn components, three create-next-app icons and the CSS rules that
only they referenced. The home screenshot baseline is unchanged."
git push -u origin chore/remove-dead-ui
gh pr create --base main --title "chore: remove dead interface code" --body-file - <<'EOF'
## What changes for the player or researcher?

Nothing visible: the Playwright screenshot baseline from the previous PR still matches. Removes components nothing renders (the SVG village map, VillageLife, the mobile hook, 56 of 61 shadcn files, three starter icons) and the CSS rules that only they used.

## Verification

- Every removed CSS class has zero references in app/, components/, lib/.
- typecheck, lint, build, unit tests and `npm run test:e2e` (including the visual baseline) pass.

## Limits or follow-up

Part 4 of the foundation cleanup. Styling consolidation itself is deferred to the UI architecture sub-project.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 6: Governance files

**Files:**
- Create: `CODE_OF_CONDUCT.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/labels.yml`, `scripts/sync-labels.mjs`
- Modify: `CONTRIBUTING.md`, `README.md` (Discussions link)

- [ ] **Step 1: Write the files**

```bash
git checkout -b chore/governance main
```

`.github/CODEOWNERS`:

```
# Review requests default to the maintainer.
* @Lingikaushikreddy
```

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    labels: ["area: infra", "dependencies"]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    labels: ["area: infra", "dependencies"]
```

`.github/labels.yml`:

```yaml
- { name: "good first issue", color: "7057ff", description: "Small, well-scoped and documented. A good first pull request." }
- { name: "help wanted", color: "008672", description: "The maintainer would welcome a contribution here." }
- { name: "bug", color: "d73a4a", description: "Something behaves differently from the docs or the game rules." }
- { name: "enhancement", color: "a2eeef", description: "A focused improvement to gameplay, research or tooling." }
- { name: "documentation", color: "0075ca", description: "Guides, README, changelog or code comments." }
- { name: "dependencies", color: "0366d6", description: "Dependency updates, mostly from Dependabot." }
- { name: "area: engine", color: "c2e0c6", description: "lib/sim: the deterministic social engine and evaluator." }
- { name: "area: game", color: "c2e0c6", description: "lib/game: economy, crew, development, battle, council." }
- { name: "area: testbed", color: "c2e0c6", description: "lib/testbed and the eval:agent CLI." }
- { name: "area: ui", color: "c2e0c6", description: "components/ and app/: the playable interface." }
- { name: "area: docs", color: "c2e0c6", description: "docs/ and guides." }
- { name: "area: infra", color: "c2e0c6", description: "CI, release, hosting, repository settings." }
```

`scripts/sync-labels.mjs`:

```js
// One-shot: create or update the repository labels from .github/labels.yml.
// Usage: node scripts/sync-labels.mjs   (needs `gh auth status` to succeed)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = readFileSync(".github/labels.yml", "utf8");
const labels = [...source.matchAll(/name: "([^"]+)", color: "([0-9a-f]{6})", description: "([^"]*)"/g)];
if (!labels.length) throw new Error("No labels parsed from .github/labels.yml");
for (const [, name, color, description] of labels) {
  const result = spawnSync(
    "gh",
    ["label", "create", name, "--color", color, "--description", description, "--force"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exitCode = 1;
}
```

`CODE_OF_CONDUCT.md`: the Contributor Covenant 2.1 text (fetch it with `curl -sL https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md -o CODE_OF_CONDUCT.md`), then replace `[INSERT CONTACT METHOD]` with `Kaushikreddylingireddy2002@gmail.com`.

- [ ] **Step 2: Extend CONTRIBUTING.md and README.md**

Insert after the "Useful contributions" section of `CONTRIBUTING.md`:

```markdown
## Your first pull request

1. Pick an issue labelled [good first issue](https://github.com/Lingikaushikreddy/Settlement-Village/labels/good%20first%20issue) or [help wanted](https://github.com/Lingikaushikreddy/Settlement-Village/labels/help%20wanted). If none fits, ask in [Discussions](https://github.com/Lingikaushikreddy/Settlement-Village/discussions) before writing code.
2. Comment on the issue so it is not picked up twice.
3. Follow "Make and verify a change" below. The whole verification block must pass locally; CI runs the same commands on Node 22, 24 and 26.
4. Open the pull request with the template filled in. The maintainer reviews within a few days.

Settlement follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
```

In `README.md`, change the header link row to add `· [Discuss](https://github.com/Lingikaushikreddy/Settlement-Village/discussions)` after `[Contribute](CONTRIBUTING.md)`.

- [ ] **Step 3: Apply labels and enable Discussions (manual, recorded)**

```bash
node scripts/sync-labels.mjs
gh repo edit --enable-discussions
gh label list | wc -l    # expect at least 12
```

Discussion categories (Q&A, Ideas, Show and tell) are GitHub defaults when Discussions are enabled; confirm in the repository's Discussions tab.

- [ ] **Step 4: Verify, commit, PR 5**

```bash
npm run lint && npm run build
git add -A
git commit -m "chore: add code of conduct, code owners, Dependabot and contributor labels"
git push -u origin chore/governance
gh pr create --base main --title "chore: contributor governance" --body-file - <<'EOF'
## What changes for the player or researcher?

Nothing in the game. Contributors get a code of conduct (Contributor Covenant 2.1), CODEOWNERS, weekly Dependabot updates for npm and Actions, a label set with a one-shot sync script, a Discussions board, and a "Your first pull request" path in CONTRIBUTING.

## Verification

- `node scripts/sync-labels.mjs` created the 12 labels; `gh repo edit --enable-discussions` done.
- lint and build pass (markdown and YAML only otherwise).

## Limits or follow-up

Branch protection is applied after the final PR of this series merges. Part 5 of the foundation cleanup.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 7: Release workflow, changelog and version

**Files:**
- Create: `.github/workflows/release.yml`, `docs/foundation-cleanup-verification.md`
- Modify: `CHANGELOG.md`, `package.json` (version), `package-lock.json` (version), `README.md` (verification link)

- [ ] **Step 1: Write `release.yml`**

```bash
git checkout -b chore/release-0.6.0 main
```

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      SETTLEMENT_LIVE_AI: "false"
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
      - run: npm run evaluate -- --verify docs/evaluation-results.json
      - run: npm run eval:agent -- --verify public/examples/agent-report.json
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - name: Extract release notes from CHANGELOG.md
        run: |
          version="${GITHUB_REF_NAME#v}"
          awk -v v="$version" '
            $0 ~ "^## " v " " { on = 1; next }
            on && /^## / { exit }
            on { print }
          ' CHANGELOG.md > release-notes.md
          test -s release-notes.md || { echo "No CHANGELOG section for $version"; exit 1; }
          cat release-notes.md
      - name: Create the GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "$GITHUB_REF_NAME" --title "Settlement $GITHUB_REF_NAME" --notes-file release-notes.md --latest
```

- [ ] **Step 2: Add the changelog entry and bump the version**

Insert at the top of `CHANGELOG.md`, directly under `# Changelog`:

```markdown
## 0.6.0 — 2026-10-XX

- **One build system.** The unused vinext/Cloudflare Workers build, the ChatGPT auth helper, the Drizzle/D1 stubs and the starter install scripts are removed. Settlement builds, runs and deploys with Next.js only. 25 dependencies nothing imported are gone.
- Next 16.4.0 closes the open security advisories; `npm audit --omit=dev` is clean.
- CI runs on Node 22, 24 and 26. The worker integration test passes on Node 26.
- A Playwright smoke suite (`npm run test:e2e`) checks the village, development start, browser report verification, second-tab blocking and a home-screen baseline on every pull request.
- Dead interface code removed: the SVG village map, VillageLife, 56 unused shadcn components and their CSS. The home screenshot is unchanged.
- Contributor governance: code of conduct, CODEOWNERS, Dependabot, labels, Discussions, a first-PR guide, and a protected `main` branch that requires a green pull request.
- Releases are created by a workflow from `v*` tags using these notes.

Gameplay, reference reports, agent reports and saved villages are unchanged.
```

Replace `XX` with the actual day when the PR opens. Then:

```bash
npm version 0.6.0 --no-git-tag-version
```

- [ ] **Step 3: Test the changelog extraction locally**

```bash
awk -v v=0.6.0 '$0 ~ "^## " v " " { on = 1; next } on && /^## / { exit } on { print }' CHANGELOG.md | tee /tmp/notes.md
grep -c "0.5.0" /tmp/notes.md   # expect 0
```

- [ ] **Step 4: Write the verification record**

Create `docs/foundation-cleanup-verification.md` in the style of `docs/village-v5-verification.md`: date, Node versions used, the full command list with results, dependency count before (24 runtime + 19 dev) and after (9 + 10), `npm audit --omit=dev` output, the Playwright run summary, the screenshot comparison result, and a link to the ruleset. Fill in the actual numbers from the PRs; do not estimate. Link it from the README "Verification" section in place of the v0.5.0 link.

- [ ] **Step 5: Verify, commit, PR 6**

```bash
npm test && npm run test:integration && npm run evaluate -- --verify docs/evaluation-results.json \
  && npm run eval:agent -- --verify public/examples/agent-report.json && npm run typecheck && npm run lint && npm run build && npm run test:e2e
git add -A
git commit -m "chore: release workflow, changelog and version 0.6.0"
git push -u origin chore/release-0.6.0
gh pr create --base main --title "chore: release 0.6.0" --body-file - <<'EOF'
## What changes for the player or researcher?

Version 0.6.0 of the foundation cleanup: a release workflow that publishes GitHub Releases from `v*` tags using the CHANGELOG section, the 0.6.0 changelog entry, and the verification record.

## Verification

- Full verification block plus `npm run test:e2e`.
- Changelog extraction tested locally: the 0.6.0 section only.

## Limits or follow-up

After merge: apply the main ruleset, then push the `v0.6.0` tag.
EOF
gh pr checks --watch && gh pr merge --squash --delete-branch && git checkout main && git pull
```

---

### Task 8: Protect main and tag the release

**Files:** none in the repository; GitHub settings and a tag.

- [ ] **Step 1: Create the ruleset**

```bash
gh api -X POST repos/Lingikaushikreddy/Settlement-Village/rulesets --input - <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "verify (24)" } ] } }
  ]
}
EOF
gh api repos/Lingikaushikreddy/Settlement-Village/rulesets --jq '.[] | "\(.name) \(.enforcement)"'
```

Expected: `main active`.

- [ ] **Step 2: Prove the protection**

```bash
git checkout main && git pull
git commit --allow-empty -m "test: protection probe" && git push origin main; echo "exit $?"
git reset --hard origin/main
```

Expected: the push is rejected with a rules message and exit is non-zero. The reset discards the probe commit.

- [ ] **Step 3: Tag and release**

```bash
git tag -a v0.6.0 -m "Settlement v0.6.0 — one build system, protected main, browser smoke tests"
git push origin v0.6.0
gh run watch "$(gh run list --workflow Release --limit 1 --json databaseId --jq '.[0].databaseId')"
gh release view v0.6.0 --json url,name --jq '"\(.name) \(.url)"'
```

Expected: the Release workflow passes and the release page shows the 0.6.0 notes.

- [ ] **Step 4: Record the ruleset link**

Add the ruleset URL (`https://github.com/Lingikaushikreddy/Settlement-Village/settings/rules`) to `docs/foundation-cleanup-verification.md` through a final small PR, since direct pushes are now blocked. That PR is the first one to go through the protection, which is itself the evidence.
