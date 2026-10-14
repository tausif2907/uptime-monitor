import { prisma } from "@uptime/database";
import { formatUptime, STATUS_PAGE_DAYS } from "@uptime/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncidentList } from "@/components/incident-list";
import { StatusBadge } from "@/components/status-badge";
import { UptimeBars } from "@/components/uptime-bars";
import { Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getDailyCounts, lastDayKeys, windowUptime } from "@/lib/stats";

// Public and cacheable: regenerate at most once a minute (checks don't run faster than that).
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

async function getProject(slug: string) {
  return prisma.project.findUnique({
    where: { slug },
    include: {
      monitors: {
        where: { isPaused: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, status: true, lastCheckedAt: true },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug);
  return { title: project ? `${project.name} status` : "Status page not found" };
}

export default async function StatusPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const monitorIds = project.monitors.map((m) => m.id);
  const [daily, incidents] = await Promise.all([
    getDailyCounts(monitorIds, STATUS_PAGE_DAYS),
    prisma.incident.findMany({
      where: {
        monitorId: { in: monitorIds },
        startedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { monitor: { select: { name: true } } },
    }),
  ]);

  const dayKeys = lastDayKeys(STATUS_PAGE_DAYS);
  const down = project.monitors.filter((m) => m.status === "DOWN");
  const lastUpdated = project.monitors.reduce<Date | null>(
    (latest, m) => (m.lastCheckedAt && (!latest || m.lastCheckedAt > latest) ? m.lastCheckedAt : latest),
    null,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>

      <div
        className={`mt-6 rounded-xl px-5 py-4 font-medium text-white ${
          project.monitors.length === 0 ? "bg-zinc-500" : down.length > 0 ? "bg-down" : "bg-up"
        }`}
      >
        {project.monitors.length === 0
          ? "No services are being monitored yet"
          : down.length > 0
            ? `${down.length} of ${project.monitors.length} services are down`
            : "All systems operational"}
      </div>
      <p className="mt-2 text-xs text-zinc-500">Last checked {timeAgo(lastUpdated)}</p>

      <Card className="mt-8 divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
        {project.monitors.map((monitor) => {
          const perDay = daily.get(monitor.id);
          return (
            <section key={monitor.id} className="p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="font-medium">{monitor.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums text-zinc-500">
                    {formatUptime(windowUptime(perDay, STATUS_PAGE_DAYS))}
                  </span>
                  <StatusBadge status={monitor.status} />
                </div>
              </div>
              <UptimeBars days={dayKeys.map((date) => ({ date, counts: perDay?.get(date) }))} />
              <div className="mt-1 flex justify-between text-xs text-zinc-400">
                <span>{STATUS_PAGE_DAYS} days ago</span>
                <span>Today</span>
              </div>
            </section>
          );
        })}
      </Card>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Past incidents (14 days)</h2>
        <Card>
          <IncidentList
            showCause={false}
            incidents={incidents.map((i) => ({ ...i, cause: i.monitor.name }))}
          />
        </Card>
      </section>

      <footer className="mt-12 text-center text-xs text-zinc-400">Powered by Uptime Monitor</footer>
    </main>
  );
}
