import { expect, test } from "@playwright/test";

test("the sample agent report verifies in the browser", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Try a sample agent report" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Agent report verified" })).toBeVisible({
    timeout: 45_000,
  });
});

test("a report with custom scenario definitions imports and verifies in the browser", async ({ page }) => {
  await page.goto("/?view=research");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import & verify" }).click();
  await (await chooser).setFiles("tests/e2e/fixtures/custom-report.json");
  await expect(page.getByRole("status").filter({ hasText: "Agent report verified" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Leaving at Dawn").first()).toBeVisible();
});
