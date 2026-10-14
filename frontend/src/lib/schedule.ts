import {
  getChecksQueue,
  removeMonitorSchedule,
  syncMonitorSchedule,
  type SchedulableMonitor,
} from "@uptime/shared/server";

const QUEUE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Redis did not answer in time")), QUEUE_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Called in the same request as every monitor create/update/pause/delete so the queue follows
 * the DB immediately. If Redis is briefly unavailable we log instead of failing the user's
 * request: the worker's reconciler re-syncs from Postgres within 10 minutes.
 */
export async function scheduleMonitor(monitor: SchedulableMonitor): Promise<void> {
  try {
    await withTimeout(syncMonitorSchedule(getChecksQueue(), monitor));
  } catch (err) {
    console.error(`[schedule] sync failed for ${monitor.id}; reconciler will repair`, err);
  }
}

export async function unscheduleMonitor(monitorId: string): Promise<void> {
  try {
    await withTimeout(removeMonitorSchedule(getChecksQueue(), monitorId));
  } catch (err) {
    console.error(`[schedule] remove failed for ${monitorId}; reconciler will repair`, err);
  }
}
