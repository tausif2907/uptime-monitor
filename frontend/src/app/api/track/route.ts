import { prisma } from "@uptime/database";
import { auth } from "@/auth";
import { deviceType, isBot, normalisePath, optedOut, referrerHost, visitorHash } from "@/lib/analytics";
import { consume } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";

/** POST /api/track — records one page view. Always answers 204 so it never leaks anything. */
export async function POST(req: Request) {
  const done = () => new Response(null, { status: 204 });
  const ua = req.headers.get("user-agent");
  if (isBot(ua) || optedOut(req.headers)) return done();
  // Only accept beacons from our own pages.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return done();

  let body: { path?: unknown; referrer?: unknown };
  try {
    body = await req.json();
  } catch {
    return done();
  }
  const path = normalisePath(body.path);
  if (!path) return done();

  const ip = ipFromHeaders(req.headers);
  const visitorId = visitorHash(ip, ua!);
  const { blocked } = await consume([{ key: `track:${visitorId}`, limit: 300, windowSec: 60 * 60 }]);
  if (blocked) return done();

  const session = await auth();
  await prisma.pageView.create({
    data: {
      path,
      referrer: referrerHost(body.referrer, req.headers.get("host")),
      visitorId,
      userId: session?.user?.id ?? null,
      device: deviceType(ua),
    },
  });
  return done();
}
