import { prisma } from "@uptime/database";
import { formatUptime } from "@uptime/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarRange, Gauge, Pause, Pencil, Play, Timer, Trash2, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { IncidentList } from "@/components/incident-list";
import { ResponseTimeChart } from "@/components/response-time-chart";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/action-button";
import { buttonClass, Card, PageHeader, Stat } from "@/components/ui";
import { checkNow, deleteMonitor, togglePauseMonitor } from "@/lib/actions/monitors";
import { isReadOnlyForDemo } from "@/lib/demo";
import { formatDateTime, formatInterval, timeAgo } from "@/lib/format";
import { requireMonitor } from "@/lib/session";
import { getDailyCounts, getUptime24h, windowUptime } from "@/lib/stats";

type Props = { params: Promise<{ projectId: string; monitorId: string }> };

export const metadata: Metadata = { title: "Monitor" };

export default async function MonitorPage({ params }: Props) {
  const { projectId, monitorId } = await params;
  const { user, monitor } = await requireMonitor(monitorId);
  if (monitor.projectId !== projectId) notFound();
  const readOnly = isReadOnlyForDemo(user, monitor.project);

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
          readOnly ? undefined : (
            <>
              <ActionButton action={checkNow.bind(null, monitorId)} variant="primary" title="Run a check right now">
                <Zap className="h-4 w-4" /> Check now
              </ActionButton>
              <Link href={`/projects/${projectId}/monitors/${monitorId}/edit`} className={buttonClass("secondary")}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <ActionButton action={togglePauseMonitor.bind(null, monitorId)}>
                {monitor.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {monitor.isPaused ? "Resume" : "Pause"}
              </ActionButton>
              <ActionButton action={deleteMonitor.bind(null, monitorId)} variant="danger" confirm="Delete this monitor and all its history?">
                <Trash2 className="h-4 w-4" /> Delete
              </ActionButton>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Uptime 24h" value={formatUptime(uptime24h.get(monitorId) ?? null)} icon={<Gauge className="h-4 w-4" />} tone="up" />
        <Stat label="Uptime 7d" value={formatUptime(windowUptime(perDay, 7))} icon={<CalendarDays className="h-4 w-4" />} />
        <Stat label="Uptime 30d" value={formatUptime(windowUptime(perDay, 30))} icon={<CalendarRange className="h-4 w-4" />} />
        <Stat label="Avg response 24h" value={avgMs != null ? `${avgMs} ms` : "—"} icon={<Timer className="h-4 w-4" />} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-1 font-semibold">Response time (24h)</h2>
        <p className="mb-4 text-xs text-zinc-500">How long the site took to answer each check. Hover the line for details.</p>
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
