import { expect, test } from "@playwright/test";

/**
 * Happy path: sign in -> create project -> add monitor -> worker checks it -> status turns UP
 * -> the public status page shows it.
 */
test("sign in, add a monitor, see it go UP on the dashboard and status page", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const slug = `e2e-${suffix}`;

  // Sign in with the seeded demo account.
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Create a project.
  await page.getByLabel("Project name").fill(`E2E ${suffix}`);
  await page.getByLabel("Status page slug").fill(slug);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: `E2E ${suffix}` })).toBeVisible();

  // Add a monitor.
  await page.getByRole("link", { name: "Add monitor" }).click();
  await page.getByLabel("Name").fill("Example");
  await page.getByLabel("URL").fill(process.env.E2E_TARGET_URL ?? "https://example.com");
  await page.getByRole("button", { name: "Create monitor" }).click();
  await expect(page.getByRole("heading", { name: /Example/ })).toBeVisible();

  // Wait for the worker's first check to flip the status to UP.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name: /Example/ })).toContainText("Up");
  }).toPass({ timeout: 90_000, intervals: [3_000] });

  // The public status page shows the monitor.
  await page.goto(`/status/${slug}`);
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(page.getByText("All systems operational")).toBeVisible();

  // Clean up so the shared demo account doesn't fill up with test projects.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: new RegExp(`E2E ${suffix}`) }).click();
  await page.getByRole("link", { name: "Settings & alerts" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
