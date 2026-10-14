import { prisma } from "@uptime/database";
import type { Queue } from "bullmq";
import {
  monitorSchedulerId,
  syncMonitorSchedule,
  type CheckJobData,
} from "@uptime/shared/server";
import { logger } from "./logger";

/**
 * The API adds/removes a monitor's job in the same request as the DB write, but a crash or a
 * Redis blip between the two can leave them out of sync. Every 10 minutes (and at startup) we
 * treat Postgres as the source of truth and make the queue match it.
 */
export async function reconcileSchedules(queue: Queue<CheckJobData>, { force = false } = {}) {
  const monitors = await prisma.monitor.findMany({
    select: { id: true, intervalSec: true, isPaused: true },
  });
  const schedulers = await queue.getJobSchedulers(0, -1);
  const existing = new Map(schedulers.map((s) => [s.key, s]));

  let added = 0;
  let removed = 0;
  const wanted = new Set<string>();

  for (const monitor of monitors) {
    if (monitor.isPaused) continue;
    const id = monitorSchedulerId(monitor.id);
    wanted.add(id);
    const current = existing.get(id);
    // Only touch schedulers that are missing or have a stale interval, so we don't reset timers.
    // `force` (used once at startup) re-applies every scheduler so job-option changes take effect.
    if (force || !current || Number(current.every) !== monitor.intervalSec * 1000) {
      await syncMonitorSchedule(queue, monitor);
      added++;
    }
  }

  for (const key of existing.keys()) {
    if (!wanted.has(key)) {
      await queue.removeJobScheduler(key);
      removed++;
    }
  }

  logger.info("reconciled schedules", { monitors: monitors.length, added, removed });
  return { monitors: monitors.length, added, removed };
}
