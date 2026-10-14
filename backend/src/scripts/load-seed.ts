/**
 * Load test, step 1: create N monitors (default 1000) at 1-minute intervals that all point at
 * the local mock target, and schedule them.
 *
 *   pnpm --filter @uptime/backend load:target          # terminal 1
 *   ALLOW_PRIVATE_TARGETS=true pnpm dev:backend        # terminal 2 (worker)
 *   pnpm --filter @uptime/backend load:seed 1000    # terminal 3
 *   ... wait 10+ minutes ...
 *   pnpm --filter @uptime/backend load:report
 *
 * Re-running replaces the previous load-test project.
 */
import { prisma } from "@uptime/database";
import { getChecksQueue, syncMonitorSchedule } from "@uptime/shared/server";

const count = Number(process.argv[2] ?? 1000);
const targetPort = Number(process.env.LOAD_TARGET_PORT ?? 4100);
const SLUG = "load-test";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "load-test@uptime.local" },
    update: {},
    create: { email: "load-test@uptime.local", name: "Load Test" },
  });

  const queue = getChecksQueue();
  const old = await prisma.monitor.findMany({ where: { project: { slug: SLUG } }, select: { id: true } });
  for (const m of old) await queue.removeJobScheduler(`monitor:${m.id}`);
  await prisma.project.deleteMany({ where: { slug: SLUG } });

  const project = await prisma.project.create({
    data: { name: "Load test", slug: SLUG, ownerId: user.id },
  });

  await prisma.monitor.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      projectId: project.id,
      name: `Load ${i + 1}`,
      url: `http://127.0.0.1:${targetPort}/m/${i + 1}`,
      intervalSec: 60,
      timeoutMs: 10_000,
    })),
  });

  const monitors = await prisma.monitor.findMany({
    where: { projectId: project.id },
    select: { id: true, intervalSec: true, isPaused: true },
  });
  for (const m of monitors) await syncMonitorSchedule(queue, m);

  console.log(`Created and scheduled ${monitors.length} monitors in project "${SLUG}".`);
  console.log("Make sure the worker runs with ALLOW_PRIVATE_TARGETS=true for this test.");
  await queue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
