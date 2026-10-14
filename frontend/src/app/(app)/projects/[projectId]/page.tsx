import { prisma } from "@uptime/database";
import { formatUptime, MAX_MONITORS_PER_PROJECT } from "@uptime/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatInterval, timeAgo } from "@/lib/format";
import { requireProject } from "@/lib/session";
import { getUptime24h } from "@/lib/stats";

type Props = { params: Promise<{ projectId: string }> };

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);

  const monitors = await prisma.monitor.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const uptime = await getUptime24h(monitors.map((m) => m.id));
  const atLimit = monitors.length >= MAX_MONITORS_PER_PROJECT;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title={project.name}
        description={
          <Link href={`/status/${project.slug}`} className="hover:underline" target="_blank">
            Public status page: /status/{project.slug} ↗
          </Link>
        }
        actions={
          <>
            <Link href={`/projects/${projectId}/settings`} className={buttonClass("secondary")}>
              Settings & alerts
            </Link>
            {!atLimit && (
              <Link href={`/projects/${projectId}/monitors/new`} className={buttonClass("primary")}>
                Add monitor
              </Link>
            )}
          </>
        }
      />

      {monitors.length === 0 ? (
        <EmptyState title="No monitors yet">
          <Link href={`/projects/${projectId}/monitors/new`} className="underline">
            Add a URL to watch
          </Link>{" "}
          — the first check runs within a minute.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3 font-medium">Monitor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Response</th>
                <th className="px-5 py-3 font-medium">24h uptime</th>
                <th className="px-5 py-3 font-medium">Last check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {monitors.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${projectId}/monitors/${m.id}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    <p className="max-w-xs truncate text-xs text-zinc-500">
                      {m.method} {m.url} · every {formatInterval(m.intervalSec)}
                    </p>
                  </td>
                  <td className="px-5 py-3" data-testid="monitor-status">
                    <StatusBadge status={m.status} paused={m.isPaused} />
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {m.lastResponseTimeMs != null ? `${m.lastResponseTimeMs} ms` : "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatUptime(uptime.get(m.id) ?? null)}</td>
                  <td className="px-5 py-3 text-zinc-500">{timeAgo(m.lastCheckedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {atLimit && (
        <p className="mt-3 text-sm text-zinc-500">
          This project has reached the limit of {MAX_MONITORS_PER_PROJECT} monitors.
        </p>
      )}
    </>
  );
}
