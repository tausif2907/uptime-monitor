import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonitorForm } from "@/components/forms/monitor-form";
import { Card, PageHeader } from "@/components/ui";
import { updateMonitor } from "@/lib/actions/monitors";
import { requireMonitor } from "@/lib/session";

export const metadata: Metadata = { title: "Edit monitor" };

export default async function EditMonitorPage({
  params,
}: {
  params: Promise<{ projectId: string; monitorId: string }>;
}) {
  const { projectId, monitorId } = await params;
  const { monitor } = await requireMonitor(monitorId);
  if (monitor.projectId !== projectId) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Edit ${monitor.name}`}
        description={
          <Link href={`/projects/${projectId}/monitors/${monitorId}`} className="hover:underline">
            ← Back to monitor
          </Link>
        }
      />
      <Card>
        <MonitorForm action={updateMonitor.bind(null, monitorId)} defaults={monitor} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
