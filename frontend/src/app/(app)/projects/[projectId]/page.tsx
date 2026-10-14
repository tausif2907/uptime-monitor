import { prisma } from "@uptime/database";
import { formatUptime, MAX_MONITORS_PER_PROJECT } from "@uptime/shared";
import { ExternalLink, Plus, Radar, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton } from "@/components/copy-button";
import { HeartbeatBars } from "@/components/heartbeat-bars";
import { StatusBadge } from "@/components/status-badge";
import { Alert, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { isReadOnlyForDemo } from "@/lib/demo";
import { formatInterval, timeAgo } from "@/lib/format";
import { appUrl } from "@/lib/request";
import { requireProject } from "@/lib/session";
import { getRecentBeats, getUptime24h } from "@/lib/stats";

type Props = { params: Promise<{ projectId: string }> };

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const { user, project } = await requireProject(projectId);
  const readOnly = isReadOnlyForDemo(user, project);

  const monitors = await prisma.monitor.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  const ids = monitors.map((m) => m.id);
  const [uptime, beats] = await Promise.all([getUptime24h(ids), getRecentBeats(ids)]);
  const atLimit = monitors.length >= MAX_MONITORS_PER_PROJECT;
  const statusUrl = `${appUrl()}/status/${project.slug}`;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title={project.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link href={`/status/${project.slug}`} className="inline-flex items-center gap-1 hover:text-brand-600" target="_blank">
              Public status page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <CopyButton value={statusUrl} label="Copy link" />
          </span>
        }
        actions={
          <>
            <Link href={`/projects/${projectId}/settings`} className={buttonClass("secondary")}>
              <Settings className="h-4 w-4" /> Settings & alerts
            </Link>
            {!atLimit && !readOnly && (
              <Link href={`/projects/${projectId}/monitors/new`} className={buttonClass("primary")}>
                <Plus className="h-4 w-4" /> Add monitor
              </Link>
            )}
          </>
        }
      />

      {readOnly && (
        <Alert tone="info" className="mb-6">
          This sample project is read-only. Create your own project from the dashboard to try adding and editing monitors.
        </Alert>
      )}

      {monitors.length === 0 ? (
        <EmptyState title="No monitors yet" icon={<Radar className="h-6 w-6" />}>
          <Link href={`/projects/${projectId}/monitors/new`} className="font-medium text-brand-600 hover:underline">
            Add a URL to watch
          </Link>{" "}
          — the first check runs within a minute.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {monitors.map((m, i) => (
            <Link key={m.id} href={`/projects/${projectId}/monitors/${m.id}`} className="block animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <Card className="group grid items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow-md sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_auto] dark:hover:border-brand-700">
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-400">{m.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {m.method} {m.url} · every {formatInterval(m.intervalSec)}
                  </p>
                </div>
                <div data-testid="monitor-status">
                  <StatusBadge status={m.status} paused={m.isPaused} />
                </div>
                <div className="hidden md:block">
                  <HeartbeatBars beats={beats.get(m.id) ?? []} />
                </div>
                <div className="flex gap-5 text-right text-sm">
                  <div>
                    <p className="tabular-nums font-medium">{m.lastResponseTimeMs != null ? `${m.lastResponseTimeMs} ms` : "—"}</p>
                    <p className="text-xs text-zinc-500">{timeAgo(m.lastCheckedAt)}</p>
                  </div>
                  <div className="w-16">
                    <p className="tabular-nums font-medium">{formatUptime(uptime.get(m.id) ?? null)}</p>
                    <p className="text-xs text-zinc-500">24h</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {atLimit && (
        <p className="mt-3 text-sm text-zinc-500">This project has reached the limit of {MAX_MONITORS_PER_PROJECT} monitors.</p>
      )}
    </>
  );
}
