import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Redis } from "ioredis";

/** Start every run with clean rate-limit counters so earlier runs can't lock tests out. */
export default async function globalSetup() {
  const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  if (!process.env.REDIS_URL) return;
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  try {
    const keys = await redis.keys("rl:*");
    if (keys.length) await redis.del(...keys);
  } finally {
    redis.disconnect();
  }
}
