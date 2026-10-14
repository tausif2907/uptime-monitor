function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  redisUrl: process.env.REDIS_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Max checks in flight at once — a few hanging sites can't starve the rest. */
  concurrency: int("WORKER_CONCURRENCY", 20),
  port: int("PORT", 4000),
  allowPrivateTargets: process.env.ALLOW_PRIVATE_TARGETS === "true",
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Uptime Monitor <onboarding@resend.dev>",
};

/** Fail fast on startup instead of on the first job. */
export function assertConfig(): void {
  const missing = (["REDIS_URL", "DATABASE_URL"] as const).filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
