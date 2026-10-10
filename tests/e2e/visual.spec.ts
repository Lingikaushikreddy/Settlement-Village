import { expect, test } from "@playwright/test";

test("the home view matches its baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("gold: 1250")).toBeVisible();
  // The crew board and HUD are static at tick 0; production bubbles are hidden by reduced motion.
  await expect(page).toHaveScreenshot("home.png", { fullPage: true, animations: "disabled" });
});
