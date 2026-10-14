import { createServer, type Server } from "node:http";
import { prisma } from "@uptime/database";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { errorMessage } from "./logger";

/**
 * GET /health — 200 when Postgres and Redis answer, 503 otherwise.
 * Also reports queue depth so a load test (or you) can see whether the worker keeps up.
 * Add this URL as a monitor in the app itself: the monitor watches its own worker.
 */
export function startHealthServer(port: number, redis: Redis, queue: Queue): Server {
  const startedAt = new Date();

  const server = createServer(async (req, res) => {
    if (req.method !== "GET" || (req.url !== "/health" && req.url !== "/")) {
      res.writeHead(404).end();
      return;
    }

    const body: Record<string, unknown> = {
      status: "ok",
      uptimeSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
    };
    let healthy = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      body.database = "ok";
    } catch (err) {
      healthy = false;
      body.database = errorMessage(err);
    }

    try {
      await redis.ping();
      body.redis = "ok";
      body.queue = await queue.getJobCounts("waiting", "active", "delayed", "failed");
    } catch (err) {
      healthy = false;
      body.redis = errorMessage(err);
    }

    if (!healthy) body.status = "degraded";
    res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });

  server.listen(port);
  return server;
}
