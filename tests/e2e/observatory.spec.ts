import { expect, test } from "@playwright/test";

const SEEDED = "/?view=research&seed=42&scenario=scarcity&policy=baseline";
const tickLabel = (page: import("@playwright/test").Page) => page.locator(".tick-label strong");
const notice = (page: import("@playwright/test").Page, text: string | RegExp) =>
  page.locator(".notice").filter({ hasText: text });
// The research desk first shows the one-snapshot council run (also "The Missing Grain", 32 ticks);
// the ?seed= run replaces it a moment later. Wait for the seeded run's 60-tick label.
async function openSeeded(page: import("@playwright/test").Page) {
  await page.goto(SEEDED);
  await expect(page.locator(".tick-label span")).toContainText("60 ticks");
}

test("plays, pauses, steps and rewinds a seeded recorded run", async ({ page }) => {
  await openSeeded(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".tick-label span")).toContainText("Playing");
  await expect(tickLabel(page)).toHaveText(/Tick 0[2-9]/, { timeout: 5000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".tick-label span")).toContainText("Paused");
  await page.getByRole("button", { name: "Rewind to beginning" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("finds the first incident and opens its evidence", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: /Find an incident/ }).click();
  await expect(tickLabel(page)).toHaveText("Tick 08");
  await expect(page.locator(".incident-card").first()).toBeVisible();
  await page.locator(".incident-card").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Recorded evidence · tick \d+/)).toBeVisible();
  await dialog.getByRole("button", { name: /Go to this tick/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lists recorded events in the feed and on the public board", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: /Find an incident/ }).click();
  await page.getByRole("tab", { name: "Event feed" }).click();
  await expect(page.locator(".event-item").first()).toBeVisible();
  await page.getByRole("tab", { name: "Public board" }).click();
  await expect(page.locator(".board-note").first()).toBeVisible();
});

test("shows the village metrics and switches to Compare", async ({ page }) => {
  await openSeeded(page);
  const metrics = page.locator(".metrics-panel");
  await expect(metrics.getByText("Behavioral resistance")).toBeVisible();
  await expect(metrics.locator(".wealth-chart > div").first()).toBeVisible();
  await metrics.getByRole("button", { name: /Compare decision policies/ }).click();
  await expect(page.getByRole("heading", { name: "Test a different decision." })).toBeVisible();
});

test("creates a browser simulation and queues an intervention", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByLabel("World seed").fill("7");
  await dialog.getByRole("button", { name: "Create simulation" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".research-boundary")).toContainText("Browser experiment");
  await expect(tickLabel(page)).toHaveText("Tick 00");
  await page.getByRole("combobox", { name: "Intervene in simulation" }).click();
  await page.getByRole("option", { name: "Add 12 grain" }).click();
  await expect(notice(page, "Intervention queued for the next new tick.")).toBeVisible();
  await page.getByRole("button", { name: "Advance one tick" }).click();
  await expect(tickLabel(page)).toHaveText("Tick 01");
});

test("rejects a seed outside the range", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: /New experiment/ }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new simulation" });
  await dialog.getByLabel("World seed").fill("1000000");
  await dialog.getByRole("button", { name: "Create simulation" }).click();
  await expect(notice(page, "Choose a whole-number seed from 0 to 999999.")).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("saves a run and keeps it in the archive across a reload", async ({ page }) => {
  await openSeeded(page);
  await page.getByRole("button", { name: "Save run" }).click();
  await expect(notice(page, "Run saved to this browser.")).toBeVisible();
  await page.goto("/?view=archive");
  const row = page.locator(".library-row").filter({ hasText: "Seed 42" });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open replay" }).click();
  await expect(page.locator(".research-boundary")).toContainText("Recorded evidence");
  await expect(tickLabel(page)).toHaveText("Tick 00");
});

test("reports unreadable saved runs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("settlement-library-v1", "{not json"));
  await page.goto("/?view=research");
  await expect(notice(page, "Saved runs could not be read.")).toBeVisible();
});

test("registers the model-context tools and seeks with them", async ({ page }) => {
  await page.addInitScript(() => {
    const tools: { name: string; execute: (input?: unknown) => unknown }[] = [];
    (window as unknown as { __tools: typeof tools }).__tools = tools;
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool: (tool: (typeof tools)[number]) => {
        tools.push(tool);
      },
    };
  });
  await openSeeded(page);
  await expect(tickLabel(page)).toHaveText("Tick 00");
  const names = await page.evaluate(() => (window as unknown as { __tools: { name: string }[] }).__tools.map((t) => t.name));
  expect(names).toEqual(["settlement_inspect_run", "settlement_seek_tick"]);
  await page.evaluate(() => (window as unknown as { __tools: { execute: (i: unknown) => unknown }[] }).__tools[1].execute({ tick: 5 }));
  await expect(tickLabel(page)).toHaveText("Tick 05");
  const inspected = await page.evaluate(() => (window as unknown as { __tools: { execute: () => { tick: number; mode: string } }[] }).__tools[0].execute());
  expect(inspected).toMatchObject({ tick: 5, mode: "recorded" });
});
