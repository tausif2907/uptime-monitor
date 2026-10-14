/**
 * Seed script — creates a demo account with a project, monitors and fake history
 * so the dashboard and status page have something to show on a fresh database.
 *
 * Idempotent: re-running wipes and recreates the demo project only.
 * Run with: pnpm db:seed
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@uptime.local";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo-password";
const DEMO_SLUG = "demo";

const DEMO_MONITORS = [
  { name: "Example.com", url: "https://example.com", intervalSec: 60 },
  { name: "GitHub", url: "https://github.com", intervalSec: 120 },
  { name: "Cloudflare DNS", url: "https://1.1.1.1", intervalSec: 300 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash, emailVerified: new Date() },
  });

  // Recreate the demo project from scratch (cascades monitors, checks, incidents...).
  await prisma.project.deleteMany({ where: { slug: DEMO_SLUG } });
  const project = await prisma.project.create({
    data: {
      name: "Demo Project",
      slug: DEMO_SLUG,
      ownerId: user.id,
      alertChannels: { create: { type: "EMAIL", target: DEMO_EMAIL } },
    },
  });

  const now = new Date();
  const today = startOfUtcDay(now);

  for (const [index, m] of DEMO_MONITORS.entries()) {
    const monitor = await prisma.monitor.create({
      data: {
        projectId: project.id,
        name: m.name,
        url: m.url,
        intervalSec: m.intervalSec,
        status: "UP",
        lastCheckedAt: now,
        lastResponseTimeMs: randomBetween(80, 250),
      },
    });

    // 24h of raw checks at 5-minute spacing (keeps the seed fast).
    const checks = [];
    for (let t = now.getTime() - DAY_MS; t <= now.getTime(); t += 5 * 60 * 1000) {
      const ok = Math.random() > 0.01;
      checks.push({
        monitorId: monitor.id,
        checkedAt: new Date(t),
        ok,
        statusCode: ok ? 200 : 503,
        responseTimeMs: randomBetween(60, 400),
        error: ok ? null : "Expected status 200, got 503",
      });
    }
    await prisma.checkResult.createMany({ data: checks });

    // 90 days of daily rollups for the status page bars.
    const stats = [];
    for (let day = 90; day >= 1; day--) {
      const totalChecks = Math.round((24 * 60 * 60) / m.intervalSec);
      const failures = Math.random() > 0.93 ? randomBetween(1, 30) : 0;
      stats.push({
        monitorId: monitor.id,
        date: new Date(today.getTime() - day * DAY_MS),
        totalChecks,
        okChecks: totalChecks - failures,
        avgMs: randomBetween(90, 220),
        p95Ms: randomBetween(250, 600),
      });
    }
    await prisma.dailyStat.createMany({ data: stats });

    // One resolved incident on the first monitor so the history page isn't empty.
    if (index === 0) {
      const startedAt = new Date(now.getTime() - 3 * DAY_MS);
      await prisma.incident.create({
        data: {
          monitorId: monitor.id,
          startedAt,
          resolvedAt: new Date(startedAt.getTime() + 7 * 60 * 1000),
          cause: "Expected status 200, got 503",
        },
      });
    }
  }

  console.log(`Seeded demo account ${DEMO_EMAIL} with project /status/${DEMO_SLUG}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
