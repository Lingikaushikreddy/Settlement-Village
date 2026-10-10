import { expect, test } from "@playwright/test";

test("a second tab is blocked until the first closes", async ({ context }) => {
  const first = await context.newPage();
  await first.goto("/");
  await expect(first.getByRole("complementary", { name: "Village orders" })).toBeVisible();

  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: "Your village is open in another tab" }),
  ).toBeVisible();

  await first.close();
  await second.getByRole("button", { name: "Retry after closing other tab" }).click();
  await expect(second.getByRole("complementary", { name: "Village orders" })).toBeVisible();
});
