# Uptime Monitor

<p align="left"><img src="frontend/src/app/icon.svg" width="56" alt="uptime logo"></p>

An uptime monitoring app with public status pages. It checks your websites every 1–5 minutes, records response times, opens an incident after 2 consecutive failures, emails you when a site goes down and when it recovers, and gives every project a public `/status/<slug>` page with 90 days of history.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Auth.js · Recharts · Node.js worker · BullMQ · PostgreSQL + Prisma · Redis · Resend · Vitest · Playwright

**Highlights:** sign up with email + password (verified), Google, GitHub or a magic link · two-factor authentication · Test URL before saving · Check now · heartbeat bars and charts · in-app guide with an interactive incident simulator · searchable help centre · dark mode. Security is documented and tested in [docs/SECURITY.md](docs/SECURITY.md).

> **Live demo:** _add your Vercel URL here after deploying_ · demo login: click **"Try the demo account"** on the sign-in page · demo status page: `/status/demo`

---

## Architecture

```
            ┌──────────────────────────┐      add/remove job        ┌───────────┐
 Browser ──▶│  frontend/ (Next.js)     │ ─────────────────────────▶ │   Redis   │
            │  dashboard, auth, CRUD,  │                            │  (BullMQ) │
            │  public status pages     │                            └─────┬─────┘
            └────────────┬─────────────┘                                  │ due jobs
                         │ read / write                                   ▼
                         ▼                                   ┌──────────────────────────┐
                  ┌──────────────┐   save results, incidents │  backend/ (worker)       │──▶ websites
                  │  PostgreSQL  │ ◀──────────────────────── │  HTTP checks, incidents, │
                  └──────────────┘                           │  alerts, nightly rollup  │──▶ Resend email / webhooks
                                                             └──────────────────────────┘
```

The web app **schedules** the work and a separate worker **does** it, so a slow website can never slow down the dashboard. The core engineering decisions are written up in [DECISIONS.md](DECISIONS.md): scheduling, timeouts, flapping, SSRF, data growth and exactly-once alerts.

## Folder structure

```
uptime-monitor/
├── frontend/                 Next.js web app (deploys to Vercel)
│   ├── src/app/              routes: /, /login, /dashboard, /projects/..., /status/[slug], /api/health
│   ├── src/components/       UI: status badge, response-time chart, 90-day uptime bars, forms
│   ├── src/lib/actions/      server actions: project / monitor / alert-channel CRUD (+ queue sync)
│   ├── src/lib/stats.ts      uptime % queries (DailyStat rollups + raw checks)
│   ├── src/auth.ts           Auth.js: Google, email magic link (Resend), demo login
│   └── e2e/                  Playwright end-to-end test
├── backend/                  Background worker (deploys to Railway / Render / Fly.io)
│   ├── src/index.ts          starts the BullMQ workers, schedulers and /health server
│   ├── src/checker.ts        one HTTP check: timeout, manual redirects, SSRF re-check per hop
│   ├── src/processor.ts      check → nextState() → incident open/resolve (one transaction)
│   ├── src/notifier.ts       exactly-once email / webhook alerts
│   ├── src/reconciler.ts     re-syncs queue jobs from the DB every 10 min
│   ├── src/rollup.ts         nightly DailyStat rollup + 30-day raw data cleanup
│   ├── src/scripts/          load test: mock target, seed N monitors, report
│   ├── test/                 integration tests (mock HTTP server, real Postgres)
│   └── Dockerfile
├── packages/
│   ├── database/             Prisma schema, migrations, seed script, shared Prisma client
│   └── shared/               Zod schemas, nextState(), uptime maths, SSRF guard, queue helpers (+ unit tests)
├── docs/DEPLOYMENT.md        step-by-step deploy guide (Vercel + Railway + Resend + Google/GitHub sign-in)
├── docs/SECURITY.md          security checklist: what's protected and how it's tested
├── docker-compose.yml        local Postgres + Redis
├── DECISIONS.md              engineering decisions
└── .github/workflows/ci.yml  lint, type-check, tests, build, e2e
```

## Run it locally

**Prerequisites:** Node.js 22+, pnpm 9 (`npm i -g pnpm`), Docker Desktop.

```bash
pnpm run bootstrap  # creates .env, installs deps, starts Postgres + Redis, migrates and seeds the database
pnpm dev            # runs the web app (http://localhost:3000) and the worker together
```

Then open http://localhost:3000, **create an account** (without `RESEND_API_KEY` the verification link is shown right on the page), or click **Try the demo account**, and you'll see a demo project with three monitors and seeded history. Real checks start within a minute.

- Port 3000 taken? Run `pnpm --filter @uptime/frontend exec next dev -p 3100` instead.
- Without `RESEND_API_KEY`, emails (sign-in links and alerts) are **printed to the worker / web console** instead of being sent.
- Worker health: http://localhost:4000/health

### Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | web app + worker in watch mode |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript across the monorepo |
| `pnpm test` | unit tests (shared) + integration tests (backend; DB tests need Postgres running) |
| `pnpm test:e2e` | Playwright: sign in → add monitor → it goes UP → status page shows it (needs the worker running) |
| `pnpm build` | production build of every package |
| `pnpm db:deploy` / `pnpm db:seed` / `pnpm db:studio` | apply migrations / seed demo data / browse the DB |

## Testing

| Layer | What's tested | Where |
|---|---|---|
| Unit | every `nextState()` transition, uptime % maths, SSRF guard (private IPs, encoded IPs, DNS tricks, schemes) | `packages/shared/src/*.test.ts` |
| Integration | worker against a local mock server: 200, 500, slow, hung, redirects, redirect loops, refused connections | `backend/test/checker.integration.test.ts` |
| Integration (DB) | full pipeline on real Postgres: blip ≠ outage, 2 failures open 1 incident, duplicate alerts suppressed, recovery resolves | `backend/test/processor.integration.test.ts` |
| End-to-end | sign up → verify → create project → Test URL → add monitor → status turns UP → public status page | `frontend/e2e/monitor.spec.ts` |
| Security (e2e) | 20 attack scenarios: XSS, SQLi, CSRF, IDOR, SSRF, brute force, 2FA, enumeration, reset links, CORS, headers, source maps, leaked secrets, spam relay | `frontend/e2e/security.spec.ts` |
| Load | 1,000 monitors at 1-minute intervals | `backend/src/scripts/load-*.ts` |

## Load test results

Run locally on one machine (worker concurrency 20, Postgres + Redis in Docker, a local mock target answering in 20–200 ms):

| Monitors | Interval | Checks/min (expected) | Failures | p50 | p95 | p99 | Queue backlog |
|---|---|---|---|---|---|---|---|
| 1,000 | 1 min | **1,000** (1,000) | 0 | 114 ms | **195 ms** | 203 ms | **0** waiting |

The worker kept up with no backlog over a 5-minute window. Check latency is dominated by the target's own 20–200 ms response time, so the scheduling and processing overhead is small.

Reproduce it:
```bash
pnpm --filter @uptime/backend load:target                 # terminal 1: mock target on :4100
ALLOW_PRIVATE_TARGETS=true pnpm dev:backend               # terminal 2: worker
pnpm --filter @uptime/backend load:seed 1000              # terminal 3: create + schedule 1000 monitors
pnpm --filter @uptime/backend load:report 5               # after 5+ minutes
```

## Deployment

Web on **Vercel**, worker on **Railway** (with Railway Postgres + Redis), email via **Resend**. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Roadmap (stretch goals)

- SSL certificate expiry warnings (14 days ahead)
- Keyword checks (page must or must not contain a string)
- Slack / Discord alerts (already possible with the webhook channel type: the payload includes `text` and `content`)
- Team invites with owner / member roles
- Embeddable SVG status badge
- A second check region to confirm outages before alerting
- Pin vetted IPs in the HTTP client to close the DNS-rebinding gap (see DECISIONS.md §4)
