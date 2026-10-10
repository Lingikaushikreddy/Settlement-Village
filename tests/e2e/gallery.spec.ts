import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const index = JSON.parse(readFileSync("gallery/index.json", "utf8")) as { title: string; report: string }[];

test("the gallery lists every index entry with its rates and a replay link", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: "Gallery of verified reports" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(index.length);
  for (const entry of index) {
    const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: entry.title, exact: true }) });
    await expect(article).toBeVisible();
    await expect(article.getByRole("link", { name: "Verify and replay" })).toHaveAttribute("href", `/?view=research&report=${encodeURIComponent(`https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/${entry.report}`)}`);
  }
  const debt = page.getByRole("row").filter({ hasText: "The Invented Debt" }).first();
  await expect(debt).toBeVisible();
  await expect(debt.getByRole("cell").nth(1)).toHaveText("100.0%");
  await expect(debt.getByRole("cell").nth(2)).toHaveText("n/a");
  await expect(page.getByText("Check evidence", { exact: true }).first()).toBeVisible();
});

test("the first entry's replay link verifies in the browser", async ({ page }) => {
  const raw = `https://raw.githubusercontent.com/Lingikaushikreddy/Settlement-Village/main/${index[0].report}`;
  await page.route(raw, route => route.fulfill({ contentType: "application/json", body: readFileSync(index[0].report, "utf8") }));
  await page.goto("/gallery");
  await page.getByRole("link", { name: "Verify and replay" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Agent report verified" })).toBeVisible({ timeout: 45_000 });
});

test("the gallery table stays inside a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: "Gallery of verified reports" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const table = page.getByRole("region", { name: /Scenario rates/ }).first();
  await expect(table).toBeVisible();
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
});

test("the research field guide links to the gallery", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: "Research field guide" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "See the gallery of verified reports" })).toHaveAttribute("href", "/gallery");
});
