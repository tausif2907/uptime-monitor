# Deployment guide

| Piece | Host | Why |
|---|---|---|
| `frontend/` (Next.js) | **Vercel** | Zero-config Next.js hosting with preview deploys for every PR |
| `backend/` (worker) | **Railway** | Needs an always-on process (BullMQ worker); serverless can't run it |
| PostgreSQL + Redis | **Railway** (same project as the worker) | Regular Redis, not per-command serverless Redis (BullMQ polls constantly) |
| Email | **Resend** | Magic-link sign-in and incident alerts |

Both Vercel and Railway redeploy automatically when you push to `main`. CI runs on every PR.

---

## 1. Resend (email)

1. Sign up at https://resend.com and create an **API key**.
2. Until you verify a domain, Resend can only send **to your own account email**, from `onboarding@resend.dev`. That's fine for testing alerts to yourself. To email other people, verify a domain under *Domains* and set `EMAIL_FROM="Uptime Monitor <alerts@yourdomain.com>"`.

## 2. Railway: Postgres, Redis and the worker

1. Create a project at https://railway.com → **Deploy from GitHub repo** → pick `uptime-monitor`.
2. In the project, add **Database → PostgreSQL** and **Database → Redis**.
3. Open the service created from the repo (this is the worker):
   - **Settings → Config-as-code → Railway config file:** `backend/railway.json`. This builds `backend/Dockerfile` from the repo root and health-checks `/health`.
   - **Settings → Networking → Generate domain** (so you can monitor `/health`).
   - **Variables:**
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     REDIS_URL=${{Redis.REDIS_URL}}
     APP_URL=https://<your-vercel-app>.vercel.app
     RESEND_API_KEY=<from step 1>
     EMAIL_FROM=Uptime Monitor <onboarding@resend.dev>
     WORKER_CONCURRENCY=20
     ```
4. Deploy. The container runs `prisma migrate deploy` before starting, so **migrations run as a deploy step, never by hand**.
5. Check `https://<worker-domain>/health`; it should return `{"status":"ok", ...}`.

> For Vercel you'll need the **public** connection strings: Postgres → *Connect* → `DATABASE_PUBLIC_URL`, and Redis → *Connect* → `REDIS_PUBLIC_URL`.

## 3. Vercel: the web app

1. https://vercel.com → **Add New → Project** → import `uptime-monitor`.
2. **Root Directory:** `frontend`. Framework is detected as Next.js, and pnpm workspaces are handled automatically.
3. **Environment variables:**
   ```
   DATABASE_URL=<Railway DATABASE_PUBLIC_URL>
   REDIS_URL=<Railway REDIS_PUBLIC_URL>
   AUTH_SECRET=<run: npx auth secret>
   APP_URL=https://<your-vercel-app>.vercel.app
   RESEND_API_KEY=<from step 1>
   EMAIL_FROM=Uptime Monitor <onboarding@resend.dev>
   DEMO_LOGIN_ENABLED=true
   DEMO_EMAIL=demo@uptime.local
   DEMO_PASSWORD=<pick a new value; it's only used server-side>
   # optional Google sign-in:
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```
4. Deploy, then check `https://<app>.vercel.app/api/health`.

### Google sign-in (optional)
Google Cloud Console → *APIs & Services → Credentials → OAuth client ID (Web)*. Set the authorised redirect URI to `https://<app>.vercel.app/api/auth/callback/google`, and add `http://localhost:3000/api/auth/callback/google` for local dev.

## 4. Seed the production demo account (once)

From your machine, with the **public** Postgres URL and the same demo password you set on Vercel:

```bash
DATABASE_URL="<Railway DATABASE_PUBLIC_URL>" DEMO_PASSWORD="<same as Vercel>" pnpm db:seed
```

(On Windows PowerShell, set them first: `$env:DATABASE_URL="..."; $env:DEMO_PASSWORD="..."; pnpm db:seed`.)

## 5. Dogfood it

Sign in and create a project. Then add monitors for:
- your own sites, once you have something live
- the worker itself: `https://<worker-domain>/health`
- the web app itself: `https://<app>.vercel.app/api/health`

Put the live URL and demo instructions at the top of the README.

## 6. CI/CD summary

- **Every PR:** GitHub Actions runs lint, type-check, unit + integration tests (with Postgres and Redis service containers), a production build, and the Playwright e2e test against the full stack.
- **Merge to `main`:** Vercel deploys the web app and Railway deploys the worker (and runs migrations). In Railway, enable *Settings → Wait for CI* so a red build never ships.

## Alternatives for the worker

- **Render:** a *Background Worker* (paid) or *Web Service* using `backend/Dockerfile`, with Docker context = repo root and health check `/health`.
- **Fly.io:** `fly launch --dockerfile backend/Dockerfile`, then set the same env vars as secrets.
