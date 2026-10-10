import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixtures/village-save.json", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
});

test("builds from the Build dialog and places the building on the map", async ({ page }) => {
  await page.locator(".build-button").click();
  const dialog = page.getByRole("dialog", { name: "Make room for possibility." });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Watchtower/ }).click();
  await expect(page.getByText("Place your watchtower")).toBeVisible();
  await page.getByRole("button", { name: /^Place building at/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Builder on the way!" })).toBeVisible();
  await expect(page.getByLabel(/^gold: /)).not.toHaveAttribute("aria-label", "gold: 1250");
});

test("selects the town hall and reads its panel", async ({ page }) => {
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  const panel = page.locator(".building-panel");
  await expect(panel.getByRole("heading", { name: "Town hall" })).toBeVisible();
  await expect(panel.getByText("Level 1")).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Upgrade/ })).toBeVisible();
  // Selecting the same building again deselects it (the close button is not clickable at desktop width today).
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  await expect(panel).toHaveCount(0);
});

test("opens the guide from the banner", async ({ page }) => {
  await page.getByRole("button", { name: "Open village guide" }).click();
  await expect(page.getByRole("dialog", { name: "Welcome home, chief." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export save" })).toBeVisible();
});

test("imports a saved village from the guide", async ({ page }) => {
  await page.getByRole("button", { name: "Select Town hall level 1" }).click();
  await expect(page.locator(".building-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open village guide" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole("status").filter({ hasText: "Village restored from your save." })).toBeVisible();
  await expect(page.getByLabel("gold: 999")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".building-panel")).toHaveCount(0);
});

test("opens research from the URL and returns to the village", async ({ page }) => {
  await page.goto("/?view=research");
  const caption = page.locator(".research-map-caption");
  await expect(caption.getByText("Recorded replay")).toBeVisible();
  await expect(page.locator(".build-button")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Settlement navigation" }).getByRole("button", { name: "Village" }).click();
  await expect(caption).toHaveCount(0);
  await expect(page.locator(".build-button")).toBeVisible();
});

test("toggles game sound", async ({ page }) => {
  await page.getByRole("button", { name: "Enable game sounds" }).click();
  await expect(page.getByRole("button", { name: "Mute game sounds" })).toBeVisible();
  await page.waitForTimeout(600); // three game ticks
  await expect(page.getByRole("button", { name: "Mute game sounds" })).toBeVisible();
});

test("dismisses a notice", async ({ page }) => {
  await page.getByRole("button", { name: "Open village guide" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  const toast = page.getByRole("status").filter({ hasText: "Village restored from your save." });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss message" }).click();
  await expect(toast).toHaveCount(0);
});

test("the campaign fits a 390px phone width without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
