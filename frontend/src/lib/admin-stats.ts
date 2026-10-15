import { prisma } from "@uptime/database";

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

export interface DailyRow {
  day: string; // YYYY-MM-DD
  views: number;
  visitors: number;
  signups: number;
}

/** Everything the admin dashboard shows, in a handful of aggregate queries. */
export async function getAdminStats() {
  const [
    users,
    verifiedUsers,
    newUsers1d,
    newUsers7d,
    newUsers30d,
    activatedUsers,
    activeUsers7d,
    twoFactorUsers,
    projects,
    monitors,
    pausedMonitors,
    downMonitors,
    checks24h,
    failedChecks24h,
    openIncidents,
    incidents7d,
    alertsSent7d,
    alertsFailed7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(30) } } }),
    // "Activated" = has at least one monitor: the number that really matters.
    prisma.user.count({ where: { projects: { some: { monitors: { some: {} } } } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: ago(7) }, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }).then((r) => r.length),
    prisma.user.count({ where: { totpEnabledAt: { not: null } } }),
    prisma.project.count(),
    prisma.monitor.count(),
    prisma.monitor.count({ where: { isPaused: true } }),
    prisma.monitor.count({ where: { isPaused: false, status: "DOWN" } }),
    prisma.checkResult.count({ where: { checkedAt: { gte: ago(1) } } }),
    prisma.checkResult.count({ where: { checkedAt: { gte: ago(1) }, ok: false } }),
    prisma.incident.count({ where: { resolvedAt: null } }),
    prisma.incident.count({ where: { startedAt: { gte: ago(7) } } }),
    prisma.notification.count({ where: { createdAt: { gte: ago(7) }, status: "SENT" } }),
    prisma.notification.count({ where: { createdAt: { gte: ago(7) }, status: "FAILED" } }),
  ]);

  const [traffic, daily, topPages, topReferrers, devices, recentUsers] = await Promise.all([
    getTraffic(),
    getDaily(30),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: ago(30) } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
    prisma.pageView.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: ago(30) }, referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 10,
    }),
    prisma.pageView.groupBy({
      by: ["device"],
      where: { createdAt: { gte: ago(30) } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerified: true,
        passwordHash: true,
        totpEnabledAt: true,
        accounts: { select: { provider: true } },
        projects: { select: { _count: { select: { monitors: true } } } },
      },
    }),
  ]);

  return {
    users: { total: users, verified: verifiedUsers, new1d: newUsers1d, new7d: newUsers7d, new30d: newUsers30d, activated: activatedUsers, active7d: activeUsers7d, twoFactor: twoFactorUsers },
    usage: { projects, monitors, paused: pausedMonitors, down: downMonitors, checks24h, failedChecks24h, openIncidents, incidents7d, alertsSent7d, alertsFailed7d },
    traffic,
    daily,
    topPages: topPages.map((p) => ({ label: p.path, count: p._count._all })),
    topReferrers: topReferrers.map((r) => ({ label: r.referrer ?? "—", count: r._count._all })),
    devices: devices.map((d) => ({ label: d.device, count: d._count._all })),
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      verified: Boolean(u.emailVerified),
      twoFactor: Boolean(u.totpEnabledAt),
      methods: [...(u.passwordHash ? ["password"] : []), ...u.accounts.map((a) => (a.provider === "resend" ? "email link" : a.provider))],
      monitors: u.projects.reduce((n, p) => n + p._count.monitors, 0),
    })),
  };
}

async function getTraffic() {
  const rows = await prisma.$queryRaw<{ win: string; views: number; visitors: number }[]>`
    SELECT w.win,
           COUNT(pv.id)::int AS views,
           COUNT(DISTINCT pv."visitorId")::int AS visitors
    FROM (VALUES ('1d', 1), ('7d', 7), ('30d', 30)) AS w(win, days)
    LEFT JOIN "PageView" pv ON pv."createdAt" >= NOW() - make_interval(days => w.days)
    GROUP BY w.win
  `;
  const get = (w: string) => rows.find((r) => r.win === w) ?? { views: 0, visitors: 0 };
  return { d1: get("1d"), d7: get("7d"), d30: get("30d") };
}

/** Per-day page views, unique visitors and sign-ups for the last `days` days (UTC). */
async function getDaily(days: number): Promise<DailyRow[]> {
  const since = new Date(Date.now() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  const [views, signups] = await Promise.all([
    prisma.$queryRaw<{ day: string; views: number; visitors: number }[]>`
      SELECT to_char("createdAt"::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS views,
             COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "PageView" WHERE "createdAt" >= ${since}
      GROUP BY day
    `,
    prisma.$queryRaw<{ day: string; signups: number }[]>`
      SELECT to_char("createdAt"::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS signups
      FROM "User" WHERE "createdAt" >= ${since}
      GROUP BY day
    `,
  ]);
  const v = new Map(views.map((r) => [r.day, r]));
  const s = new Map(signups.map((r) => [r.day, r.signups]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day, views: v.get(day)?.views ?? 0, visitors: v.get(day)?.visitors ?? 0, signups: s.get(day) ?? 0 };
  });
}
