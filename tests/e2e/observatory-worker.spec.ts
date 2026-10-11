import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const W = "http://127.0.0.1:8787";
const fixture = (n: number) =>
  JSON.parse(readFileSync(`tests/e2e/fixtures/worker-run-${n}.json`, "utf8"));
const tickLabel = (page: Page) => page.locator(".tick-label strong");
const boundary = (page: Page) => page.locator(".research-boundary");
const quietStream = (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "retry: 600000\n\n",
  });

async function stubWorker(
  page: Page,
  stream: (route: Route) => Promise<void> = quietStream,
) {
  const commands: { action: string; expectedVersion: number }[] = [];
  const listed = { count: 0 };
  let replied!: () => void;
  const reply = new Promise<void>((resolve) => (replied = resolve));
  await page.route(`${W}/health`, (r) => r.fulfill({ json: { ok: true } }));
  await page.route(`${W}/model/status`, (r) =>
    r.fulfill({
      json: {
        ready: false,
        reason: "Stub worker: no model configured.",
        model: null,
        dailyBudgetUSD: null,
      },
    }),
  );
  await page.route(`${W}/runs`, (r) => {
    if (r.request().method() !== "GET")
      return r.fulfill({ json: { run: fixture(0), version: 1 } });
    listed.count++;
    return r.fulfill({
      json: {
        runs: [
          {
            id: "worker-w1",
            name: "Worker grain run",
            tick: 0,
            running: false,
          },
        ],
      },
    });
  });
  await page.route(`${W}/runs/worker-w1`, (r) =>
    r.fulfill({ json: { run: fixture(0), version: 1, running: false } }),
  );
  await page.route(`${W}/runs/worker-w1/stream`, stream);
  await page.route(`${W}/runs/worker-w1/commands`, async (r) => {
    commands.push(r.request().postDataJSON());
    await r.fulfill({ json: { run: fixture(1), version: 2, running: false } });
    replied();
  });
  return Object.assign(commands, { listed, reply });
}

async function connect(page: Page) {
  await page.goto("/?view=archive");
  await expect(page.getByText("On your local worker")).toBeVisible();
  await page.getByRole("button", { name: "Connect to run" }).click();
  await expect(boundary(page)).toContainText("Local worker experiment");
}

test("lists worker runs in the archive and connects to one", async ({
  page,
}) => {
  await stubWorker(page);
  await connect(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await expect(
    page.getByRole("button", { name: "Rewind to beginning" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Playback speed" }),
  ).toBeDisabled();
});

test("steps a worker run through the command endpoint", async ({ page }) => {
  const commands = await stubWorker(page);
  await connect(page);
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
  expect(commands[0]).toMatchObject({ action: "step", expectedVersion: 1 });
});

test("shows the worker's model status", async ({ page }) => {
  await stubWorker(page);
  await page.goto("/?view=research");
  await expect(
    page.getByText("Stub worker: no model configured."),
  ).toBeVisible();
});

test("creates a run on the local worker", async ({ page }) => {
  await stubWorker(page);
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByRole("button", { name: "Create on local worker" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(boundary(page)).toContainText("Local worker experiment");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("ignores a stream message for a run the player has left", async ({
  page,
}) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await stubWorker(page, async (route) => {
    await released;
    const message = JSON.stringify({
      run: fixture(2),
      version: 9,
      running: false,
    });
    await route
      .fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `retry: 600000\ndata: ${message}\n\n`,
      })
      .catch(() => {});
  });
  await connect(page);
  await page
    .getByRole("navigation", { name: "Research tools" })
    .getByRole("button", { name: "Archive" })
    .click();
  await page
    .locator(".library-feature")
    .filter({ hasText: "Included reference run" })
    .getByRole("button", { name: /Open replay/ })
    .click();
  await expect(boundary(page)).toContainText("Recorded evidence");
  release();
  await page.waitForTimeout(500);
  await expect(boundary(page)).toContainText("Recorded evidence");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("an older command reply does not roll the run back", async ({ page }) => {
  const worker = await stubWorker(page, (route) => {
    const message = JSON.stringify({
      run: fixture(2),
      version: 3,
      running: false,
    });
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `retry: 600000\ndata: ${message}\n\n`,
    });
  });
  await connect(page);
  await expect(tickLabel(page)).toHaveText("Tick 02");
  await page.getByRole("button", { name: "Advance one tick" }).click();
  // The reply (version 2, one tick) must have reached the page before the check, or the check proves nothing.
  await worker.reply;
  await page.waitForTimeout(300);
  await expect(tickLabel(page)).toHaveText("Tick 02");
});

test("opening and closing the new-experiment dialog refreshes the worker run list", async ({
  page,
}) => {
  const worker = await stubWorker(page);
  await page.goto("/?view=archive");
  await expect(page.getByText("On your local worker")).toBeVisible();
  const before = worker.listed.count;
  await page.getByRole("button", { name: /New experiment/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Start a new simulation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => worker.listed.count).toBe(before + 2);
});
