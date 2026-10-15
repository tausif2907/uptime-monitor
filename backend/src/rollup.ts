import { prisma } from "@uptime/database";
import { RAW_RETENTION_DAYS } from "@uptime/shared";
import { logger } from "./logger";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Nightly job:
 *   1. roll raw CheckResults into one DailyStat row per monitor per UTC day
 *   2. delete raw rows older than RAW_RETENTION_DAYS
 *
 * It re-computes the last `days` complete days with an upsert, so a missed night heals itself
 * and running it twice is harmless.
 */
export async function runDailyRollup(now = new Date(), days = 2) {
  const to = startOfUtcDay(now);
  const from = new Date(to.getTime() - days * DAY_MS);

  const upserted = await prisma.$executeRaw`
    INSERT INTO "DailyStat" ("monitorId", "date", "totalChecks", "okChecks", "avgMs", "p95Ms")
    SELECT
      "monitorId",
      "checkedAt"::date,
      COUNT(*)::int,
      (COUNT(*) FILTER (WHERE "ok"))::int,
      ROUND(AVG("responseTimeMs"))::int,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "responseTimeMs"))::int
    FROM "CheckResult"
    WHERE "checkedAt" >= ${from} AND "checkedAt" < ${to}
    GROUP BY "monitorId", "checkedAt"::date
    ON CONFLICT ("monitorId", "date") DO UPDATE SET
      "totalChecks" = EXCLUDED."totalChecks",
      "okChecks"    = EXCLUDED."okChecks",
      "avgMs"       = EXCLUDED."avgMs",
      "p95Ms"       = EXCLUDED."p95Ms"
  `;

  const cutoff = new Date(to.getTime() - RAW_RETENTION_DAYS * DAY_MS);
  const { count: deleted } = await prisma.checkResult.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  });

  // The demo account is shared: wipe projects visitors created there (keeps the seeded one).
  const demoEmail = (process.env.DEMO_EMAIL ?? "demo@uptime.local").toLowerCase();
  const { count: demoProjectsRemoved } = await prisma.project.deleteMany({
    where: {
      owner: { email: demoEmail },
      slug: { not: "demo" },
      createdAt: { lt: new Date(now.getTime() - DAY_MS) },
    },
  });

  // Analytics page views are kept 90 days.
  const { count: pageViewsRemoved } = await prisma.pageView.deleteMany({
    where: { createdAt: { lt: new Date(to.getTime() - 90 * DAY_MS) } },
  });

  logger.info("daily rollup done", { from, to, upserted, deleted, demoProjectsRemoved, pageViewsRemoved });
  return { upserted, deleted, demoProjectsRemoved, pageViewsRemoved };
}
