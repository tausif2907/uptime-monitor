import { prisma } from "@uptime/database";
import { formatUptime } from "@uptime/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { IncidentList } from "@/components/incident-list";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, Card, PageHeader, Stat } from "@/components/ui";
import { deleteMonitor, togglePauseMonitor } from "@/lib/actions/monitors";
import { formatDateTime, formatInterval, timeAgo } from "@/lib/format";
import { requireMonitor } from "@/lib/session";
import { getDailyCounts, getUptime24h, windowUptime } from "@/lib/stats";

type Props = { params: Promise<{ projectId: string; monitorId: string }> };

export const metadata: Metadata = { title: "Monitor" };

export default async function MonitorPage({ params }: Props) {
  const { projectId, monitorId } = await params;
  const { monitor } = await requireMonitor(monitorId);
  if (monitor.projectId !== projectId) notFound();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [checks, uptime24h, daily, incidents, recentFailures] = await Promise.all([
    prisma.checkResult.findMany({
      where: { monitorId, checkedAt: { gte: since } },
      orderBy: { checkedAt: "asc" },
      select: { checkedAt: true, responseTimeMs: true, ok: true },
    }),
    getUptime24h([monitorId]),
    getDailyCounts([monitorId], 30),
    prisma.incident.findMany({ where: { monitorId }, orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.checkResult.findMany({
      where: { monitorId, ok: false },
      orderBy: { checkedAt: "desc" },
      take: 10,
    }),
  ]);

  const perDay = daily.get(monitorId);
  const timings = checks.flatMap((c) => (c.responseTimeMs == null ? [] : [c.responseTimeMs]));
  const avgMs = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {monitor.name}
            <StatusBadge status={monitor.status} paused={monitor.isPaused} />
          </span>
        }
        description={
          <>
            <Link href={`/projects/${projectId}`} className="hover:underline">
              ← {monitor.project.name}
            </Link>
            <span className="mx-2">·</span>
            {monitor.method} {monitor.url} · every {formatInterval(monitor.intervalSec)} · expects{" "}
            {monitor.expectedStatus} · last check {timeAgo(monitor.lastCheckedAt)}
          </>
        }
        actions={
          <>
            <Link href={`/projects/${projectId}/monitors/${monitorId}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
            <form action={togglePauseMonitor.bind(null, monitorId)}>
              <SubmitButton variant="secondary" pendingText="…">
                {monitor.isPaused ? "Resume" : "Pause"}
              </SubmitButton>
            </form>
            <form action={deleteMonitor.bind(null, monitorId)}>
              <SubmitButton variant="danger" pendingText="Deleting…" confirm="Delete this monitor and all its history?">
                Delete
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Uptime 24h" value={formatUptime(uptime24h.get(monitorId) ?? null)} />
        <Stat label="Uptime 7d" value={formatUptime(windowUptime(perDay, 7))} />
        <Stat label="Uptime 30d" value={formatUptime(windowUptime(perDay, 30))} />
        <Stat label="Avg response 24h" value={avgMs != null ? `${avgMs} ms` : "—"} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Response time (24h)</h2>
        <ResponseTimeChart
          data={checks.map((c) => ({ t: c.checkedAt.getTime(), ms: c.responseTimeMs, ok: c.ok }))}
        />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent incidents</h2>
            <Link href={`/projects/${projectId}/monitors/${monitorId}/incidents`} className="text-sm hover:underline">
              Full history →
            </Link>
          </div>
          <IncidentList incidents={incidents} />
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Recent failed checks</h2>
          {recentFailures.length === 0 ? (
            <p className="text-sm text-zinc-500">No failed checks. 🎉</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {recentFailures.map((c) => (
                <li key={c.id} className="py-2">
                  <p className="text-red-600">{c.error ?? `HTTP ${c.statusCode}`}</p>
                  <p className="text-xs text-zinc-500">{formatDateTime(c.checkedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
