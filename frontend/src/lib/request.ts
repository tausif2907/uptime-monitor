import { headers } from "next/headers";

/** Best-effort client IP (Vercel and most proxies set x-forwarded-for; first entry is the client). */
export function ipFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "local";
}

export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

/** Absolute app URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
