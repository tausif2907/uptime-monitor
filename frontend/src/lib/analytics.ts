import { createHash } from "node:crypto";

/**
 * First-party, privacy-friendly page-view analytics.
 * - No cookies and no raw IP addresses are stored.
 * - Visitors are counted with a hash of (secret + date + IP + user agent): unique per day,
 *   impossible to reverse, and not linkable across days.
 * - Bots and browsers sending Do-Not-Track / Global Privacy Control are ignored.
 */

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch|go-http/i;
// cuid-style ids (e.g. cmv84dy6x0002ieecdihb77ky) → ":id" so pages group and ids don't leak.
const ID_SEGMENT_RE = /^c[a-z0-9]{20,}$/;
const EXCLUDED = [/^\/admin/, /^\/api\//, /^\/_next\//];

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export function optedOut(headers: Headers): boolean {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

/** Normalise a path for storage, or null if it shouldn't be tracked. */
export function normalisePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0]!.slice(0, 200);
  if (EXCLUDED.some((re) => re.test(path))) return null;
  // Tokens in these pages' query strings are already stripped above; keep the path generic.
  return (
    path
      .split("/")
      .map((seg) => (ID_SEGMENT_RE.test(seg) ? ":id" : seg))
      .join("/") || "/"
  );
}

/** Hostname of an external referrer, or null for internal / missing / invalid ones. */
export function referrerHost(raw: unknown, ownHost: string | null): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === ownHost?.replace(/^www\./, "").split(":")[0]) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

export function deviceType(userAgent: string | null): "mobile" | "desktop" {
  return userAgent && /mobi|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop";
}

export function visitorHash(ip: string, userAgent: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "dev"}|${day}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
