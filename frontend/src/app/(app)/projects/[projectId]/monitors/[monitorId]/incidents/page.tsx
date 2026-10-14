import { prisma } from "@uptime/database";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime, formatDuration } from "@/lib/format";
import { requireMonitor } from "@/lib/session";

export const metadata: Metadata = { title: "Incident history" };

export default async function IncidentHistoryPage({
  params,
}: {
  params: Promise<{ projectId: string; monitorId: string }>;
}) {
  const { projectId, monitorId } = await params;
  const { monitor } = await requireMonitor(monitorId);
  if (monitor.projectId !== projectId) notFound();

  const incidents = await prisma.incident.findMany({
    where: { monitorId },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: { notifications: { include: { channel: true } } },
  });

  return (
    <>
      <PageHeader
        title={`Incidents · ${monitor.name}`}
        description={
          <Link href={`/projects/${projectId}/monitors/${monitorId}`} className="hover:underline">
            ← Back to monitor
          </Link>
        }
      />
      <Card className="overflow-x-auto p-0">
        {incidents.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">No incidents recorded. 🎉</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3 font-medium">Started</th>
                <th className="px-5 py-3 font-medium">Resolved</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Cause</th>
                <th className="px-5 py-3 font-medium">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3">{formatDateTime(i.startedAt)}</td>
                  <td className="px-5 py-3">
                    {i.resolvedAt ? formatDateTime(i.resolvedAt) : <span className="text-red-600">Ongoing</span>}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatDuration(i.startedAt, i.resolvedAt)}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-zinc-500" title={i.cause ?? undefined}>
                    {i.cause ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500">
                    {i.notifications.length === 0
                      ? "—"
                      : i.notifications.map((n) => (
                          <div key={n.id}>
                            {n.event.toLowerCase()} → {n.channel.target}{" "}
                            <span className={n.status === "FAILED" ? "text-red-600" : ""}>({n.status.toLowerCase()})</span>
                          </div>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
