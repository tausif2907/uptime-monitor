import { prisma } from "@uptime/database";
import { sumCounts, uptimePercent, type CheckCounts } from "@uptime/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Per monitor: "YYYY-MM-DD" -> counts, for the last `days` UTC days including today. */
export type DailyCounts = Map<string, Map<string, CheckCounts>>;

/**
 * Daily check counts from DailyStat (the nightly rollup), topped up with raw CheckResults for
 * any day the rollup hasn't covered yet (always today; also yesterday before the nightly run,
 * or every day for a brand-new deployment). Raw rows are only scanned from the day after the
 * most recent rollup, so this stays cheap even for 90-day windows.
 */
export async function getDailyCounts(
  monitorIds: string[],
  days: number,
  now = new Date(),
): Promise<DailyCounts> {
  const result: DailyCounts = new Map(monitorIds.map((id) => [id, new Map()]));
  if (monitorIds.length === 0) return result;

  const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY_MS);

  const stats = await prisma.dailyStat.findMany({
    where: { monitorId: { in: monitorIds }, date: { gte: from } },
  });

  const lastRolled = new Map<string, number>();
  for (const s of stats) {
    result.get(s.monitorId)?.set(dayKey(s.date), {
      totalChecks: s.totalChecks,
      okChecks: s.okChecks,
    });
    lastRolled.set(s.monitorId, Math.max(lastRolled.get(s.monitorId) ?? 0, s.date.getTime()));
  }

  const rawFrom = new Date(
    Math.min(
      ...monitorIds.map((id) => {
        const last = lastRolled.get(id);
        return last ? last + DAY_MS : from.getTime();
      }),
    ),
  );

  const raw = await prisma.$queryRaw<
    { monitorId: string; day: string; total: number; ok: number }[]
  >`
    SELECT "monitorId",
           to_char("checkedAt"::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS total,
           (COUNT(*) FILTER (WHERE "ok"))::int AS ok
    FROM "CheckResult"
    WHERE "monitorId" = ANY(${monitorIds}::text[]) AND "checkedAt" >= ${rawFrom}
    GROUP BY "monitorId", day
  `;

  for (const row of raw) {
    const perDay = result.get(row.monitorId);
    if (perDay && !perDay.has(row.day)) {
      perDay.set(row.day, { totalChecks: row.total, okChecks: row.ok });
    }
  }
  return result;
}

/** The last `days` UTC day keys, oldest first (today last). */
export function lastDayKeys(days: number, now = new Date()): string[] {
  const today = startOfUtcDay(now).getTime();
  return Array.from({ length: days }, (_, i) => dayKey(new Date(today - (days - 1 - i) * DAY_MS)));
}

export function windowUptime(perDay: Map<string, CheckCounts> | undefined, days: number) {
  if (!perDay) return null;
  return uptimePercent(sumCounts(lastDayKeys(days).flatMap((k) => perDay.get(k) ?? [])));
}

/** Uptime over the last 24 hours (rolling) for many monitors, from raw checks. */
export async function getUptime24h(monitorIds: string[]): Promise<Map<string, number | null>> {
  const since = new Date(Date.now() - DAY_MS);
  const rows = await prisma.checkResult.groupBy({
    by: ["monitorId", "ok"],
    where: { monitorId: { in: monitorIds }, checkedAt: { gte: since } },
    _count: { _all: true },
  });
  const counts = new Map<string, CheckCounts>(
    monitorIds.map((id) => [id, { totalChecks: 0, okChecks: 0 }]),
  );
  for (const row of rows) {
    const c = counts.get(row.monitorId);
    if (!c) continue;
    c.totalChecks += row._count._all;
    if (row.ok) c.okChecks += row._count._all;
  }
  return new Map([...counts].map(([id, c]) => [id, uptimePercent(c)]));
}
