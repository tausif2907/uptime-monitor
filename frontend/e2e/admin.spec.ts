import { expect, test } from "@playwright/test";
import { newUser, signIn, signUpAndVerify } from "./helpers";

test.describe("Admin & analytics", () => {
  test("regular users get a 404 for /admin and see no Admin link", async ({ page }) => {
    await newUser(page, "notadmin");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("anonymous visitors are sent to sign in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("tracking endpoint ignores bots and Do-Not-Track and never errors", async ({ request }) => {
    const bot = await request.post("/api/track", {
      data: { path: "/" },
      headers: { "user-agent": "Googlebot/2.1" },
    });
    expect(bot.status()).toBe(204);
    const dnt = await request.post("/api/track", { data: { path: "/" }, headers: { dnt: "1" } });
    expect(dnt.status()).toBe(204);
    const junk = await request.post("/api/track", { data: "not json", headers: { "content-type": "text/plain" } });
    expect(junk.status()).toBe(204);
  });

  // Runs only where an admin address is configured for tests (CI sets both variables).
  test("the admin sees visitors, users and system stats", async ({ page }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    test.skip(!adminEmail, "set E2E_ADMIN_EMAIL (and ADMIN_EMAILS on the server) to run");
    await signUpAndVerify(page, adminEmail!).catch(() => undefined); // may already exist
    await signIn(page, adminEmail!);
    await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    for (const label of ["Visitors today", "Total users", "Recent sign-ups", "Checks last 24h"]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });
});
