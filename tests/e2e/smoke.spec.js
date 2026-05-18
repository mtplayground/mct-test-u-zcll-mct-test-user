import { expect, test } from "@playwright/test";

test("captures a picture and deletes it from the gallery", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByText("No captures yet.")).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Camera is ready.")).toBeVisible();
  await page.waitForFunction(() => {
    const video = document.querySelector("#camera-preview");
    return video && video.videoWidth > 0 && video.videoHeight > 0;
  });

  await page.getByRole("button", { name: "Take Picture" }).click();
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await expect(page.locator(".gallery-card img")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.locator(".gallery-card")).toHaveCount(0);
  await expect(page.getByText("No captures yet.")).toBeVisible();
});
