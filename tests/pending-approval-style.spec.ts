import { test, expect } from "@playwright/test";

// UI-only regression: synthetic /auth/me response, no database or real email.
for (const width of [320, 375, 1280]) {
  test(`pending approval uses the shared button palette and font at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/api/auth/me") {
        await route.fulfill({ json: {
          id: "style-test-admin", name: "Style Test Admin", role: "SCHOOL_ADMIN",
          email: "style@example.invalid", requiresEligibilityAttestation: false,
          school: { name: "Synthetic Style School", ownershipStatus: "PENDING" },
        } });
      } else {
        await route.fulfill({ status: 404, json: { error: "Unexpected UI-only API request" } });
      }
    });
    await page.goto("/dashboard");
    const send = page.getByRole("button", { name: "Send approval email" });
    await expect(send).toBeVisible();
    await expect(send).toHaveCSS("background-color", "rgb(26, 86, 160)");
    await expect(send).toHaveCSS("color", "rgb(255, 255, 255)");
    const font = await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily);
    for (const name of ["Send approval email", "Check approval status", "Sign out"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toHaveCSS("font-family", font);
      await expect(button).toHaveCSS("font-size", "14px");
      await expect(button).toHaveCSS("border-radius", "3px");
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await expect(page.locator("main section")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.getByText("Setup access", { exact: true })).toHaveCSS("color", "rgb(26, 86, 160)");
  });
}
