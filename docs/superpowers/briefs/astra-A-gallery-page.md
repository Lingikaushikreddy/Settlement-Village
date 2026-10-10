# Brief A: the `/gallery` page

**For:** Astra-6 · **Repository:** https://github.com/Lingikaushikreddy/Settlement-Village · **Branch:** `feat/gallery-page` from `main` · **One pull request.**

## Context (read these first)

- `docs/superpowers/specs/2026-10-10-showcase-design.md` section 3 (the page) and `docs/gallery.md`.
- `lib/gallery/index-schema.ts` (`parseGalleryIndex`), `lib/gallery/summary.ts` (`summarizeGalleryEntry`), `gallery/index.json`, `gallery/*.json` (agent reports; the type is `AgentReport` in `lib/testbed/report.ts`).
- `app/lab/page.tsx` (an existing server page), `app/layout.tsx` (metadata pattern), `components/experiments.css` (classes `evaluation-panel`, `evaluation-table`, `evaluation-verified`, `evaluation-report-heading`; reuse them), `components/agent-report.tsx` (how rates are rendered today).
- Repo rules: `CONTRIBUTING.md`. `main` is protected: open a PR; CI must be green. Do not add dependencies. Do not touch `lib/`, `scripts/`, `gallery/` or anything outside the file list below.

## Deliverable

`app/gallery/page.tsx`: a statically rendered server component (no `"use client"`, no state) that reads `gallery/index.json` and each listed report from disk at build time (use `node:fs` with paths resolved from `process.cwd()`), validates the index with `parseGalleryIndex`, computes each entry's numbers with `summarizeGalleryEntry`, and renders:

1. A header: title "Gallery of verified reports", one paragraph copied verbatim from the "What a score does not mean" list's first and third bullets in `docs/agent-testbed.md`, and a link "Submit yours" to `https://github.com/Lingikaushikreddy/Settlement-Village/blob/main/docs/gallery.md`. A "Back to the village" link to `/`.
2. One `<article>` per entry, in index order: `title`; agent name with kind as a small label (`rules` / `model` / `other`) and the homepage as a link when present; `submittedBy` and `submittedAt`; cases, seeds and engine stamp; `notes` when present; a table with columns Scenario, Attack success, Honest refusal, Invalid, Check evidence (attack success / honest refusal), one row per `summary.scenarios` entry, rates rendered as percentages with one decimal and `n/a` for `null`; a link "Verify and replay" to `/?view=research&report=https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/${entry.report}`.
3. Page `metadata`: title "Settlement gallery — verified agent reports", description one sentence.

Also:

- `app/gallery/gallery.css` only if the existing classes are insufficient; keep it under 120 lines and import it from the page. Phone width (390 px) must not scroll horizontally: wrap the table in a scrolling container.
- A "Gallery" link in the Research field guide dialog: in `components/observatory.tsx`, next to the existing "Research field guide" heading content, add one line `See the gallery of verified reports` linking to `/gallery`. Keep it minimal; no other observatory changes.
- `tests/e2e/gallery.spec.ts` (Playwright, same conventions as `tests/e2e/research.spec.ts`):

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("the gallery lists every index entry with its rates and a replay link", async ({ page }) => {
  const index = JSON.parse(readFileSync("gallery/index.json", "utf8"));
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: "Gallery of verified reports" })).toBeVisible();
  for (const entry of index) {
    await expect(page.getByRole("heading", { name: entry.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Verify and replay" }).first()).toHaveAttribute("href", /view=research&report=https%3A%2F%2Fraw\.githubusercontent\.com|view=research&report=https:\/\/raw\.githubusercontent\.com/);
  }
  await expect(page.getByText("The Invented Debt").first()).toBeVisible();
  await expect(page.getByText("Check evidence").first()).toBeVisible();
});

test("the first entry's replay link verifies in the browser", async ({ page }) => {
  await page.goto("/gallery");
  const href = await page.getByRole("link", { name: "Verify and replay" }).first().getAttribute("href");
  // The hosted replay fetches from raw.githubusercontent.com, which CI cannot rely on; rewrite to the local sample report to prove the wiring.
  await page.goto(href!.replace(/report=.*$/, "report=https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/public/examples/agent-report.json"));
  await expect(page.getByRole("status").filter({ hasText: /verified|could not be loaded/i })).toBeVisible({ timeout: 45_000 });
});
```

  If the second test is flaky offline, keep only the first and say so in the PR.

## Acceptance

- `npm run build` succeeds and `/gallery` is listed as a static route.
- `npm run test:e2e` passes (existing 8 tests plus yours).
- `npm run lint`, `npm run typecheck`, `npm test` pass; `npm run gallery:verify` is unchanged.
- Screenshots of desktop (1280 px) and phone (390 px) in the PR body.
- PR title: `feat: /gallery page for verified reports`. PR body uses `.github/pull_request_template.md`. No AI attribution lines.

## Files you may touch

`app/gallery/page.tsx`, `app/gallery/gallery.css` (optional), `components/observatory.tsx` (one link), `tests/e2e/gallery.spec.ts`, `README.md` (only to replace the `docs/gallery.md` link text with the hosted `/gallery` URL if you want). Nothing else.
