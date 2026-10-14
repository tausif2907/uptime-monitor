import { prisma } from "@uptime/database";
import { JOBS, QUEUES } from "@uptime/shared";
import { createRedisConnection, type CheckJobData } from "@uptime/shared/server";
import { Queue, Worker } from "bullmq";
import { assertConfig, config } from "./config";
import { startHealthServer } from "./health";
import { errorMessage, logger } from "./logger";
import { processCheck } from "./processor";
import { reconcileSchedules } from "./reconciler";
import { runDailyRollup } from "./rollup";

assertConfig();

const connection = createRedisConnection(config.redisUrl);
const checksQueue = new Queue<CheckJobData>(QUEUES.checks, { connection });
const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });

// --- Check worker: one job = one HTTP check for one monitor ---------------
const checksWorker = new Worker<CheckJobData>(
  QUEUES.checks,
  async (job) => processCheck(job.data.monitorId),
  { connection: createRedisConnection(config.redisUrl), concurrency: config.concurrency },
);

checksWorker.on("failed", (job, err) => {
  logger.error("check job failed", { monitorId: job?.data.monitorId, error: errorMessage(err) });
});

// --- Maintenance worker: reconciler + nightly rollup ----------------------
const maintenanceWorker = new Worker(
  QUEUES.maintenance,
  async (job) => {
    if (job.name === JOBS.reconcile) return reconcileSchedules(checksQueue);
    if (job.name === JOBS.rollup) return runDailyRollup();
    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  { connection: createRedisConnection(config.redisUrl), concurrency: 1 },
);

maintenanceWorker.on("failed", (job, err) => {
  logger.error("maintenance job failed", { job: job?.name, error: errorMessage(err) });
});

async function start() {
  await maintenanceQueue.upsertJobScheduler(
    "reconcile-every-10-min",
    { every: 10 * 60 * 1000 },
    { name: JOBS.reconcile, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );
  await maintenanceQueue.upsertJobScheduler(
    "rollup-nightly",
    { pattern: "15 0 * * *", tz: "UTC" },
    { name: JOBS.rollup, opts: { removeOnComplete: 50, removeOnFail: 50 } },
  );

  // Make the queue match the DB right away rather than waiting 10 minutes.
  await reconcileSchedules(checksQueue);

  const health = startHealthServer(config.port, connection, checksQueue);
  logger.info("worker started", {
    concurrency: config.concurrency,
    healthPort: config.port,
    allowPrivateTargets: config.allowPrivateTargets,
  });

  const shutdown = async (signal: string) => {
    logger.info("shutting down", { signal });
    health.close();
    // Let in-flight checks finish before exiting.
    await Promise.allSettled([checksWorker.close(), maintenanceWorker.close()]);
    await Promise.allSettled([checksQueue.close(), maintenanceQueue.close()]);
    await prisma.$disconnect();
    connection.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("worker failed to start", { error: errorMessage(err) });
  process.exit(1);
});
