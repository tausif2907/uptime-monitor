import { expect, test } from "@playwright/test";
import { createMonitor, createProject, newUser } from "./helpers";

/**
 * Happy path: sign up -> verify email -> create project -> add monitor -> worker checks it
 * -> status turns UP -> the public status page shows it. Needs the worker running.
 */
test("sign up, add a monitor, see it go UP on the dashboard and status page", async ({ page }) => {
  await newUser(page, "happy");
  const slug = `e2e-${Date.now().toString(36)}`;
  const projectId = await createProject(page, "E2E project", slug);

  // Test URL gives instant feedback before saving.
  await page.goto(`/projects/${projectId}/monitors/new`);
  await page.getByLabel("URL to check").fill(process.env.E2E_TARGET_URL ?? "https://example.com");
  await page.getByRole("button", { name: "Test URL" }).click();
  await expect(page.getByText(/Looks good|would fail/)).toBeVisible({ timeout: 20_000 });

  await createMonitor(page, projectId, "Example", process.env.E2E_TARGET_URL ?? "https://example.com");
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
});

test("the interactive guide simulator explains the 2-failure rule", async ({ page }) => {
  await page.goto("/guide#alerts");
  const fail = page.getByRole("button", { name: "Check fails" });
  await fail.click();
  await expect(page.getByText("One failure isn't an outage")).toBeVisible();
  await fail.click();
  await expect(page.getByText("“Site is DOWN” email sent")).toBeVisible();
  await page.getByRole("button", { name: "Check succeeds" }).click();
  await expect(page.getByText("“Back UP” email sent")).toBeVisible();
});
