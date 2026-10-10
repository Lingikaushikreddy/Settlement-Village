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
