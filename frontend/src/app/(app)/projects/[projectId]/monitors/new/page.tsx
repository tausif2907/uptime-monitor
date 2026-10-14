import type { Metadata } from "next";
import Link from "next/link";
import { MonitorForm } from "@/components/forms/monitor-form";
import { Card, PageHeader } from "@/components/ui";
import { createMonitor } from "@/lib/actions/monitors";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "New monitor" };

export default async function NewMonitorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New monitor"
        description={
          <Link href={`/projects/${projectId}`} className="hover:underline">
            ← {project.name}
          </Link>
        }
      />
      <Card>
        <MonitorForm action={createMonitor.bind(null, projectId)} />
      </Card>
    </div>
  );
}
