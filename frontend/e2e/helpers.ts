import { expect, type Page } from "@playwright/test";

/** Test-only password for throwaway accounts created during the run. */
export const TEST_PASSWORD = "E2e-test-pass-2026";

export function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

/** Sign up through the real UI and click the verification link shown in dev/test mode. */
export async function signUpAndVerify(page: Page, email: string, password = TEST_PASSWORD, name = "E2E Tester") {
  await page.goto("/signup");
  await page.waitForLoadState("networkidle"); // let React hydrate before typing (dev server)
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  const link = await page.getByRole("link", { name: "open it" }).getAttribute("href");
  expect(link).toContain("/verify-email");
  await page.goto(link!);
  await expect(page.getByText("You're all set!")).toBeVisible();
  return link!;
}

export async function signIn(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

export async function newUser(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await signUpAndVerify(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

/** Create a project from the dashboard; returns its id. */
export async function createProject(page: Page, name: string, slug: string): Promise<string> {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Project name").fill(name);
  await page.getByLabel("Status page address").fill(slug);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+/);
  return page.url().split("/projects/")[1]!.split(/[/?]/)[0]!;
}

/** Create a monitor; returns its id. */
export async function createMonitor(page: Page, projectId: string, name: string, url: string): Promise<string> {
  await page.goto(`/projects/${projectId}/monitors/new`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("URL to check").fill(url);
  await page.getByRole("button", { name: "Create monitor" }).click();
  await expect(page).toHaveURL(/\/monitors\/[^/?]+/);
  return page.url().split("/monitors/")[1]!.split(/[/?]/)[0]!;
}
