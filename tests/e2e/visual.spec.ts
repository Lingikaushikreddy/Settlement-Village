import { expect, test } from "@playwright/test";

test("the home view matches its baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  // The crew board and HUD are static at tick 0; production bubbles are hidden by reduced motion.
  await expect(page).toHaveScreenshot("home.png", { fullPage: true, animations: "disabled" });
});

test("the council view matches its baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  await page.getByRole("navigation", { name: "Settlement navigation" }).getByRole("button", { name: "Council" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("council.png", { fullPage: true, animations: "disabled" });
});

test("the research view matches its baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?view=research");
  await expect(page.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("research.png", { fullPage: true, animations: "disabled" });
});
