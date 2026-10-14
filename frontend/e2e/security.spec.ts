import { expect, test, type Page } from "@playwright/test";
import { TOTP } from "otpauth";
import {
  createMonitor,
  createProject,
  newUser,
  signIn,
  signOut,
  signUpAndVerify,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers";

/**
 * Security regression suite: each test plays an attacker against the running app.
 * Run: pnpm test:e2e   (needs Postgres + Redis; the worker is only needed for monitor.spec)
 */

test.describe("HTTP hardening", () => {
  test("security headers are set on every page", async ({ request }) => {
    for (const path of ["/", "/login", "/status/demo"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"]).toContain("object-src 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-powered-by"]).toBeUndefined();
    }
  });

  test("no permissive CORS: other origins get no Access-Control-Allow-Origin", async ({ request }) => {
    const res = await request.get("/api/health", { headers: { Origin: "https://evil.example" } });
    expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
    const preflight = await request.fetch("/api/auth/session", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("browser source maps are not served", async ({ page, request }) => {
    await page.goto("/");
    const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
    expect(scripts.length).toBeGreaterThan(0);
    // `next dev` serves source maps on purpose (unhashed chunks with ?v=); production must not.
    test.skip(scripts.some((s) => /\?v=\d+/.test(s)), "dev server — run against a production build (pnpm build && pnpm start)");
    for (const src of scripts.slice(0, 5)) {
      const res = await request.get(`${src}.map`);
      expect(res.status(), `${src}.map`).toBe(404);
    }
  });

  test("no secrets leak into client JavaScript", async ({ page, request }) => {
    await page.goto("/login");
    const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
    const forbidden = ["DATABASE_URL", "AUTH_SECRET", "RESEND_API_KEY", "postgresql://", "redis://", "$2a$12$"];
    for (const src of scripts) {
      const body = await (await request.get(src)).text();
      for (const needle of forbidden) expect(body, `${needle} in ${src}`).not.toContain(needle);
    }
  });
});

test.describe("Authentication", () => {
  test("protected pages redirect anonymous visitors to sign in", async ({ page }) => {
    for (const path of ["/dashboard", "/account", "/projects/anything", "/projects/x/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("session cookie is HttpOnly + SameSite and nothing sensitive is in localStorage", async ({ page }) => {
    await newUser(page, "cookie");
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name.includes("session-token"));
    expect(session).toBeTruthy();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toMatch(/token|session|jwt|eyJ/i);
  });

  test("unverified accounts cannot sign in", async ({ page }) => {
    const email = uniqueEmail("unverified");
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Unverified");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();

    await signIn(page, email);
    await expect(page.getByText("Please verify your email first").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("verification links are single-use", async ({ page }) => {
    const link = await signUpAndVerify(page, uniqueEmail("singleuse"));
    await page.goto(link);
    await expect(page.getByText("Link not valid")).toBeVisible();
  });

  test("brute force: account locks after 5 wrong passwords, even for the right one", async ({ page }) => {
    const email = uniqueEmail("brute");
    await signUpAndVerify(page, email);
    for (let i = 0; i < 5; i++) {
      await signIn(page, email, `wrong-password-${i}`);
      await expect(page.getByText(/Incorrect email or password|Too many/).first()).toBeVisible();
    }
    await signIn(page, email, TEST_PASSWORD);
    await expect(page.getByText(/Too many failed attempts/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login errors don't reveal whether an account exists", async ({ page }) => {
    await signIn(page, uniqueEmail("nobody"), "Whatever-123");
    const missing = await page.getByRole("alert").first().textContent();
    const email = uniqueEmail("exists");
    await signUpAndVerify(page, email);
    await signIn(page, email, "Wrong-pass-123");
    const wrong = await page.getByRole("alert").first().textContent();
    expect(missing).toBe(wrong);
  });

  test("password reset: same answer for unknown emails, links are single-use, old password stops working", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(uniqueEmail("ghost"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists for/)).toBeVisible();

    const email = uniqueEmail("reset");
    await signUpAndVerify(page, email);
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists for/)).toBeVisible();
    const link = (await page.getByRole("link", { name: "open it" }).getAttribute("href"))!;

    const newPassword = "Brand-new-pass-77";
    await page.goto(link);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: /Save new password/ }).click();
    await expect(page).toHaveURL(/\/login\?reset=1/);

    await page.goto(link); // reuse
    await page.getByLabel("New password").fill("Another-pass-88");
    await page.getByRole("button", { name: /Save new password/ }).click();
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();

    await signIn(page, email, TEST_PASSWORD);
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("two-factor authentication: code required, wrong code rejected, backup code works once", async ({ page }) => {
    const email = await newUser(page, "mfa");
    await page.goto("/account");
    await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
    const secret = (await page.locator("code").first().textContent())!.trim();
    const totp = new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" });
    await page.getByLabel(/Enter the 6-digit code/).fill(totp.generate());
    await page.getByRole("button", { name: "Turn on 2FA" }).click();
    await expect(page.getByText("Save your backup codes now")).toBeVisible();
    const backup = (await page.locator("ul.font-mono li").first().textContent())!.trim();
    await page.getByRole("button", { name: "I've saved my backup codes" }).click();
    await expect(page.getByText(/backup codes? left/)).toBeVisible();

    await signOut(page);
    await signIn(page, email);
    await expect(page.getByText("Two-factor authentication")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/6-digit code/).fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/6-digit code/).fill(backup);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // The same backup code can't be used twice.
    await signOut(page);
    await signIn(page, email);
    await page.getByLabel(/6-digit code/).fill(backup);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
  });
});

test.describe("Authorization (IDOR / broken object-level access)", () => {
  test("user B cannot see or change user A's project and monitor", async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    await newUser(a, "owner");
    const projectId = await createProject(a, "Private project", `private-${Date.now().toString(36)}`);
    const monitorId = await createMonitor(a, projectId, "Secret monitor", "https://example.com");

    const b = await (await browser.newContext()).newPage();
    await newUser(b, "intruder");
    for (const path of [
      `/projects/${projectId}`,
      `/projects/${projectId}/settings`,
      `/projects/${projectId}/monitors/new`,
      `/projects/${projectId}/monitors/${monitorId}`,
      `/projects/${projectId}/monitors/${monitorId}/edit`,
      `/projects/${projectId}/monitors/${monitorId}/incidents`,
    ]) {
      await b.goto(path);
      await expect(b.getByText("Page not found"), path).toBeVisible();
      await expect(b.getByText("Secret monitor")).toHaveCount(0);
    }
  });
});

test.describe("Injection", () => {
  test("XSS: script-like names are rendered as text, never executed", async ({ page }) => {
    await newUser(page, "xss");
    const payload = `<img src=x onerror="window.__xss=1">`;
    const slug = `xss-${Date.now().toString(36)}`;
    const projectId = await createProject(page, payload, slug);
    await createMonitor(page, projectId, `<script>window.__xss=2</script>`, "https://example.com");

    for (const path of ["/dashboard", `/projects/${projectId}`, `/status/${slug}`]) {
      await page.goto(path);
      await expect(page.getByText(payload).first()).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), path).toBeUndefined();
    }
  });

  test("SQL injection attempts are rejected safely (no 500s, no data)", async ({ page, request }) => {
    for (const slug of ["' OR '1'='1", "demo'--", "1;DROP TABLE \"User\""]) {
      const res = await request.get(`/status/${encodeURIComponent(slug)}`);
      expect(res.status(), slug).toBe(404);
    }
    await signIn(page, "' OR 1=1--@x.com", "' OR '1'='1");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});

test.describe("SSRF", () => {
  test("monitors can't target private networks or cloud metadata", async ({ page }) => {
    await newUser(page, "ssrf");
    const projectId = await createProject(page, "SSRF test", `ssrf-${Date.now().toString(36)}`);
    for (const url of ["http://169.254.169.254/latest/meta-data/", "http://127.0.0.1:5432", "http://localhost:6379", "http://[::1]/", "http://2130706433/"]) {
      await page.goto(`/projects/${projectId}/monitors/new`);
      await page.getByLabel("Name", { exact: true }).fill("evil");
      await page.getByLabel("URL to check").fill(url);
      await page.getByRole("button", { name: "Create monitor" }).click();
      await expect(page.getByText(/not allowed|private or reserved|Localhost/).first(), url).toBeVisible();
      await expect(page).toHaveURL(/\/monitors\/new/);
    }
  });

  test("the Test URL button is guarded too", async ({ page }) => {
    await newUser(page, "ssrftest");
    const projectId = await createProject(page, "SSRF test 2", `ssrf2-${Date.now().toString(36)}`);
    await page.goto(`/projects/${projectId}/monitors/new`);
    await page.getByLabel("URL to check").fill("http://169.254.169.254/");
    await page.getByRole("button", { name: "Test URL" }).click();
    await expect(page.getByText(/Blocked/)).toBeVisible();
  });
});

test.describe("CSRF", () => {
  test("a server action replayed from another origin is rejected", async ({ page, request }) => {
    const email = uniqueEmail("csrf");
    await signUpAndVerify(page, email);

    let captured: { url: string; headers: Record<string, string>; body: Buffer | null } | undefined;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postDataBuffer() };
      }
    });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/dashboard/);
    expect(captured).toBeTruthy();

    const res = await request.post(captured!.url, {
      headers: { ...captured!.headers, origin: "https://evil.example" },
      data: captured!.body ?? undefined,
      maxRedirects: 0,
    });
    const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n");
    expect(setCookie).not.toContain("session-token");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("Auth.js endpoints reject sign-in POSTs without a CSRF token", async ({ request }) => {
    const res = await request.post("/api/auth/callback/credentials", {
      form: { email: "demo@uptime.local", password: "demo-password" },
      maxRedirects: 0,
    });
    const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n");
    expect(setCookie).not.toContain("session-token");
  });
});

test.describe("Abuse prevention", () => {
  test("email alerts can only go to the account's own address (no spam relay)", async ({ page }) => {
    const email = await newUser(page, "relay");
    const projectId = await createProject(page, "Relay test", `relay-${Date.now().toString(36)}`);
    await page.goto(`/projects/${projectId}/settings`);
    // The email field is locked to the user's own address in the UI; bypass it like an attacker would.
    await page.getByLabel("Type").selectOption("EMAIL");
    await page.getByLabel("Email address").evaluate((el) => {
      (el as HTMLInputElement).readOnly = false;
      (el as HTMLInputElement).value = "victim@example.com";
    });
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/only go to your own verified address/)).toBeVisible();
    await expect(page.getByText("victim@example.com")).toHaveCount(0);
    expect(email).toContain("@e2e.test");
  });
});

// Keep the page type import used for helpers' signatures in editors.
export type { Page };
