# Security

How Uptime Monitor handles common web-app security risks, and how each item is tested.
Automated proof: `frontend/e2e/security.spec.ts` (attacks the running app), plus unit tests in
`packages/shared` and `backend/test`. CI runs all of them, plus `pnpm audit`, on every PR.

| # | Risk | Status | How it's handled | Tested by |
|---|---|---|---|---|
| 1 | SQL injection | ✅ | Prisma parameterises every query; the few raw queries use tagged templates (`$queryRaw\`…${value}\``), which are also parameterised. Slugs are regex-validated before any query. | `security.spec` › SQL injection |
| 2 | XSS | ✅ | React escapes all output; no `dangerouslySetInnerHTML` with user data. Email HTML is escaped. A strict CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`) is the second layer. | `security.spec` › XSS (payloads in project/monitor names on dashboard + public page) |
| 3 | CSRF | ✅ | Server Actions reject requests whose `Origin` doesn't match the host; Auth.js endpoints require a CSRF token; session cookies are `SameSite=Lax`. | `security.spec` › CSRF (replayed action from another origin; sign-in POST without token) |
| 4 | Insecure file uploads | N/A | The app accepts no file uploads. | — |
| 5 | IDOR / object-level auth | ✅ | Every query for a project, monitor or alert channel is scoped to `ownerId = current user` (`lib/session.ts`); a mismatch returns 404, never 403, so IDs can't be probed. | `security.spec` › user B vs user A's resources |
| 6 | Rate limiting | ✅ | Redis fixed windows (`lib/rate-limit.ts`): password sign-in (5 failures/15 min per account, 20/IP), sign-up, password reset, magic links, monitor writes, Test URL, Check now, 2FA management. | `security.spec` › brute force |
| 7 | Insecure JWT secret | ✅ | Production refuses to start with a missing, short (< 32 chars) or placeholder `AUTH_SECRET`. | `auth.ts` startup check |
| 8 | Exposed API secrets | ✅ | No `NEXT_PUBLIC_` secrets; `.env` is git-ignored; git history scanned clean. | `security.spec` › no secrets in client JS |
| 9 | Weak password hashing | ✅ | bcrypt cost 12; 8–72 chars with a letter and a digit, and not containing the email name. A dummy hash equalises timing for unknown users. | `schemas.test.ts`, `security.spec` › enumeration |
| 10 | Missing MFA | ✅ | TOTP 2FA (any authenticator app) with 10 one-time backup codes. Secrets are AES-256-GCM encrypted at rest, codes can't be replayed, and backup codes are stored as SHA-256 hashes. Magic links can't bypass 2FA. | `security.spec` › two-factor |
| 11 | Permissive CORS | ✅ | No CORS headers are sent at all, so browsers block cross-origin reads. | `security.spec` › CORS |
| 12 | Tokens in localStorage | ✅ | Sessions are `HttpOnly`, `SameSite=Lax` cookies (`Secure` on HTTPS). `localStorage` holds only the theme. | `security.spec` › session cookie |
| 13 | Client-side-only permissions | ✅ | Every rule (ownership, demo read-only, alert restrictions, limits) is enforced in server code; the UI only mirrors it. | `security.spec` › spam relay test bypasses the UI |
| 14 | Row-level security | ✅ (app layer) | Browsers never talk to the database: only our server does, with one DB role. Ownership is enforced in a single data-access layer (`requireProject`, `requireMonitor`, `requireChannel`). Postgres RLS mainly matters when clients query the DB directly (e.g. Supabase), which this architecture doesn't allow. | IDOR test |
| 15 | Webhook signatures | ✅ | We *send* webhooks: each carries `X-Uptime-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")` with a per-channel secret. The help page shows receivers how to verify it and reject replays. | `webhook-signature.test.ts` |
| 16 | SSRF | ✅ | `assertSafeUrl()` resolves DNS and blocks private, loopback, link-local/metadata, reserved and IPv4-mapped ranges and encoded IP tricks, on input and on **every redirect hop**. Webhooks and Test URL are guarded too. | `ssrf.test.ts` (37 cases), `security.spec` › SSRF |
| 17 | Exposed source maps | ✅ | `productionBrowserSourceMaps: false`; `X-Powered-By` removed. | `security.spec` › source maps (production build) |
| 18 | Default credentials | ✅ | Production refuses the default demo password and placeholder secrets. Local Postgres/Redis bind to `127.0.0.1` only. | startup checks |
| 19 | Sensitive data in logs | ✅ | Passwords, tokens and email bodies (which contain links) are never logged in production. | code review (`lib/email.ts`, `backend/src/email.ts`) |
| 20 | Vulnerable dependencies | ✅ | Upgraded Auth.js (3 critical advisories), Next.js, PostCSS and deepmerge-ts: 13 → 0 known vulnerabilities. CI fails on new high/critical ones. | `pnpm audit` in CI |

## Other protections

- **Account takeover hardening:** sign-up requires email verification. If someone signs up with *your* email and never verifies it, signing in with Google or a magic link removes their password ("pre-account-takeover").
- **No account enumeration:** sign-in, sign-up and password reset give identical answers whether or not an account exists.
- **Single-use, hashed tokens:** verification (24 h) and reset (30 min) links are stored as SHA-256 hashes and deleted on use.
- **Reset-link poisoning:** email links are built from `APP_URL`, never from the request's `Host` header.
- **Spam-relay prevention:** email alerts only go to the account's own verified address.
- **Shared demo account:** alerts off, the sample project is read-only, its other projects get no public status page, and they're wiped nightly.
- **Security headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS in production.

## Known limitations / next steps

- DNS rebinding: the hostname is resolved for the safety check and again by `fetch`. Pinning the vetted IP in the HTTP client would close the gap.
- 2FA protects email + password sign-in. Google/GitHub sign-ins rely on the provider's own 2FA.
- Rate limits trust `X-Forwarded-For` for the client IP. That's correct behind Vercel (which sets the header), but behind another proxy configure it to overwrite the header.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository rather than a public issue.
