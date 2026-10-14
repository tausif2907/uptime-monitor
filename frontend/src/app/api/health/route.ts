import { prisma } from "@uptime/database";

export const dynamic = "force-dynamic";

/** GET /api/health — 200 when the web app can reach Postgres. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
