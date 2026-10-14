/**
 * Load test, step 2: report throughput and latency for the load-test project.
 *   pnpm --filter @uptime/backend load:report 10    # last 10 minutes (default)
 *
 * Numbers to put on your resume: checks/min, p95 check latency, and a queue backlog near 0.
 */
import { prisma } from "@uptime/database";
import { percentile } from "@uptime/shared";
import { getChecksQueue } from "@uptime/shared/server";

const minutes = Number(process.argv[2] ?? 10);

async function main() {
  const since = new Date(Date.now() - minutes * 60_000);
  const project = await prisma.project.findUnique({
    where: { slug: "load-test" },
    include: { _count: { select: { monitors: true } } },
  });
  if (!project) throw new Error('No "load-test" project — run load:seed first.');

  const rows = await prisma.checkResult.findMany({
    where: { checkedAt: { gte: since }, monitor: { projectId: project.id } },
    select: { ok: true, responseTimeMs: true },
  });

  const latencies = rows.flatMap((r) => (r.responseTimeMs === null ? [] : [r.responseTimeMs]));
  const failures = rows.filter((r) => !r.ok).length;
  const counts = await getChecksQueue().getJobCounts("waiting", "active", "delayed", "failed");

  const expectedPerMin = project._count.monitors; // all load monitors run every 60 s
  const actualPerMin = rows.length / minutes;

  console.table({
    monitors: project._count.monitors,
    windowMinutes: minutes,
    totalChecks: rows.length,
    checksPerMinute: Math.round(actualPerMin),
    expectedPerMinute: expectedPerMin,
    keepingUp: actualPerMin >= expectedPerMin * 0.95 ? "yes" : "NO — backlog",
    failures,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    queueWaiting: counts.waiting,
    queueActive: counts.active,
  });

  await getChecksQueue().close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
