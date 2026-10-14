import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { JOBS, QUEUES } from "./constants";

export interface CheckJobData {
  monitorId: string;
}

/** Scheduler id for a monitor's repeatable check — one per monitor, so upserts never duplicate. */
export const monitorSchedulerId = (monitorId: string) => `monitor:${monitorId}`;

/**
 * Create a Redis connection suitable for BullMQ.
 * `maxRetriesPerRequest: null` is required by BullMQ workers.
 */
export function createRedisConnection(url = process.env.REDIS_URL): Redis {
  if (!url) throw new Error("REDIS_URL is not set");
  return new Redis(url, { maxRetriesPerRequest: null });
}

const globalForQueue = globalThis as unknown as { checksQueue?: Queue<CheckJobData> };

/** Lazily-created, process-wide producer for the checks queue. */
export function getChecksQueue(): Queue<CheckJobData> {
  if (!globalForQueue.checksQueue) {
    globalForQueue.checksQueue = new Queue<CheckJobData>(QUEUES.checks, {
      connection: createRedisConnection(),
    });
  }
  return globalForQueue.checksQueue;
}

export interface SchedulableMonitor {
  id: string;
  intervalSec: number;
  isPaused: boolean;
}

/**
 * Make the queue match the monitor: a repeatable job every `intervalSec`, or none if paused.
 * Safe to call repeatedly (upsert), which is what lets the reconciler fix any drift.
 */
export async function syncMonitorSchedule(
  queue: Queue<CheckJobData>,
  monitor: SchedulableMonitor,
): Promise<void> {
  const schedulerId = monitorSchedulerId(monitor.id);
  if (monitor.isPaused) {
    await queue.removeJobScheduler(schedulerId);
    return;
  }
  await queue.upsertJobScheduler(
    schedulerId,
    { every: monitor.intervalSec * 1000 },
    {
      name: JOBS.check,
      data: { monitorId: monitor.id },
      opts: { removeOnComplete: 1000, removeOnFail: 1000 },
    },
  );
}

export async function removeMonitorSchedule(
  queue: Queue<CheckJobData>,
  monitorId: string,
): Promise<void> {
  await queue.removeJobScheduler(monitorSchedulerId(monitorId));
}
