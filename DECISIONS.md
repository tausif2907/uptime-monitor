# Engineering decisions

This file covers the six core problems in the implementation plan, plus a few smaller choices. Each entry records what we did, why, and what we gave up.

---

## 1. Scheduling: one BullMQ job scheduler per monitor, plus a reconciler

**Decision.** Each monitor maps to one BullMQ *job scheduler* with id `monitor:<monitorId>` that repeats every `intervalSec`. Create, update, pause, resume and delete in the web app (`frontend/src/lib/actions/monitors.ts`) upsert or remove the scheduler in the same request as the DB write. Because the id is the monitor id, an upsert can never create a duplicate.

**Drift.** The DB write and the Redis write are not atomic. A crash between them, or Redis being down, can leave the two out of sync. To handle that:
- the web app logs the queue error but does not fail the user's request (with a 5 s timeout so a dead Redis can't hang it), and
- the worker runs a **reconciler** (`backend/src/reconciler.ts`) at startup and every 10 minutes. It treats Postgres as the source of truth: it adds missing schedulers, fixes stale intervals, and removes orphans. It only touches schedulers that are actually wrong, so it doesn't reset their timers.

**Trade-off.** A monitor created while Redis is down starts checking up to 10 minutes late. That's acceptable for an uptime tool. A transactional outbox would be stricter but would add another table and poller.

## 2. Timeouts and slow sites

**Decision.** Every check (`backend/src/checker.ts`) shares one `AbortController` deadline (default 10 s, max 30 s) across DNS, every redirect hop and the response headers. We cancel the response body instead of downloading the page. Worker concurrency is capped (`WORKER_CONCURRENCY`, default 20), so a few hanging sites can tie up at most a few slots and can't starve the rest.

**Why it matters.** Without a hard deadline, one tarpit server holds a worker slot forever. Integration tests check that a server that never responds is reported as `Timed out after 500 ms` in about 500 ms.

## 3. Flapping: a pure `nextState(monitor, result)` function

**Decision.** All incident logic lives in one pure function in `packages/shared/src/incident.ts`:
- a success sets the monitor UP and resets the failure counter; if it was DOWN, the incident resolves
- a failure increments the counter; at **2 consecutive failures** the monitor goes DOWN and an incident opens
- further failures while DOWN do nothing

A single blip never flips UP to DOWN. Being pure means every transition is covered by a plain unit test (`incident.test.ts`), with no DB or network involved.

**Atomicity.** The worker (`backend/src/processor.ts`) saves the CheckResult, updates the monitor's denormalised status and opens or resolves the incident in **one transaction**, so the stored status and the incidents can never disagree.

## 4. SSRF protection

Users submit URLs that our servers then fetch. Without a guard, someone could point a monitor at `http://169.254.169.254/` (cloud metadata), `localhost:6379` (our Redis) or anything else on the private network.

**Decision.** `assertSafeUrl()` in `packages/shared/src/ssrf.ts`:
- allows only `http:` / `https:` and rejects credentials in the URL
- resolves the hostname and rejects it if **any** resolved address is private or reserved: 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 0/8, multicast, reserved, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6 and others
- catches literal tricks such as `http://2130706433/`, `http://0x7f.1/` and `[::ffff:127.0.0.1]`, because the WHATWG URL parser normalises them first
- runs **on input** (in the server action, so users get a form error) **and in the worker on every redirect hop** (so a public URL can't 302 us into the private network)

Webhook alert targets go through the same guard.

**Known limitation.** DNS rebinding: the hostname is resolved once for the check, and `fetch` resolves it again. An attacker with a very short TTL could swap the answer in between. The full fix is to pin the vetted IP with a custom undici `Agent({ connect: { lookup } })`; it's listed as a follow-up. `ALLOW_PRIVATE_TARGETS=true` turns the IP checks off for tests and load tests only.

## 5. Data growth

At 100 monitors × 1-minute interval we write about 144,000 `CheckResult` rows a day.

**Decision.**
- Index `(monitorId, checkedAt DESC)` for the per-monitor chart and "latest checks" queries, plus `checkedAt` for the retention delete.
- A **nightly rollup** (00:15 UTC, `backend/src/rollup.ts`) aggregates raw rows into `DailyStat` (total, ok, avg, p95) with one `INSERT … SELECT … ON CONFLICT DO UPDATE`. It recomputes the last 2 days, so a missed night repairs itself and running it twice is harmless.
- Raw rows older than **30 days** are deleted in the same job.
- Reads (`frontend/src/lib/stats.ts`) take full days from `DailyStat` and only scan raw rows for the days the rollup hasn't covered yet (always today). The 90-day status bars therefore never scan 90 days of raw data.

## 6. Exactly-once alerts

Worker retries, or two workers handling the same monitor, could both decide to alert.

**Decision.** There are two layers of uniqueness:
1. A **partial unique index** `Incident(monitorId) WHERE resolvedAt IS NULL` (hand-written in the init migration, because Prisma can't express partial indexes). There can only ever be one open incident per monitor. Opening one uses `INSERT … ON CONFLICT DO NOTHING`.
2. A **unique `(incidentId, channelId, event)`** on `Notification`, with **insert-then-send**: the worker first inserts the Notification row (`ON CONFLICT DO NOTHING`), and only the job whose insert succeeded sends the email or webhook, then marks it `SENT` or `FAILED`.

**Trade-off.** If the process dies after the insert but before the send, that alert is lost: it stays `PENDING`, and it is visible on the incident history page. That makes delivery "at most once". We chose that deliberately, because a duplicate page at 3 a.m. is worse than a missed one, and the PENDING row makes the loss visible. A sweeper that retries stale PENDING rows would bring delivery close to exactly-once.

---

## Smaller decisions

| Decision | Why |
|---|---|
| **Monorepo** with pnpm workspaces: `frontend/`, `backend/`, `packages/database`, `packages/shared` | One Prisma client and one set of Zod schemas and domain logic, shared by both apps. |
| **Server Actions** for CRUD instead of a REST API | Less code, typed end to end, works without client JS. The domain logic stays in plain functions in `packages/shared`. |
| **JWT sessions** (Auth.js) | Required by the Credentials provider used for the demo login, and keeps auth checks DB-free. Users and accounts are still stored through the Prisma adapter. |
| **Demo account** via Credentials, only for users with a `passwordHash` (the seeded one) | Recruiters can try the app without signing up. Real users sign in with Google or an email magic link. |
| **Abuse limits**: 10 projects per user, 20 monitors per project, 1–5 minute intervals | The demo account is public, and every monitor is real outbound traffic from our server. |
| **Migrations as a deploy step**: `prisma migrate deploy` runs in the worker container's start command; CI runs it too | Never by hand. When changing the schema, use `prisma migrate dev --create-only` and **delete any generated `DROP INDEX "Incident_one_open_per_monitor"`**: Prisma doesn't know about the partial index and will try to drop it. |
| **Regular Redis**, not serverless per-command Redis | BullMQ polls Redis constantly and would exhaust a per-command free quota quickly. Redis runs with `maxmemory-policy noeviction`, as BullMQ requires. |
| **Web on Vercel, worker on Railway** | The worker needs an always-on process; serverless functions can't run a BullMQ worker. |
