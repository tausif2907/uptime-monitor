import { prisma } from "@uptime/database";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertChannelForm } from "@/components/forms/alert-channel-form";
import { ProjectForm } from "@/components/forms/project-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader } from "@/components/ui";
import { addAlertChannel, deleteAlertChannel, toggleAlertChannel } from "@/lib/actions/alerts";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const channels = await prisma.alertChannel.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description={
          <Link href={`/projects/${projectId}`} className="hover:underline">
            ← {project.name}
          </Link>
        }
      />

      <Card>
        <h2 className="mb-4 font-semibold">Project</h2>
        <ProjectForm
          action={updateProject.bind(null, projectId)}
          defaults={{ name: project.name, slug: project.slug }}
          submitLabel="Save"
        />
      </Card>

      <Card>
        <h2 className="font-semibold">Alert channels</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          Every enabled channel is notified once when an incident opens and once when it resolves.
        </p>
        <ul className="mb-6 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {channels.length === 0 && <li className="py-2 text-zinc-500">No channels — you won&apos;t be alerted.</li>}
          {channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {c.type}
                </span>
                <span className={c.isEnabled ? "" : "text-zinc-400 line-through"}>{c.target}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={toggleAlertChannel.bind(null, c.id)}>
                  <SubmitButton variant="ghost" pendingText="…">
                    {c.isEnabled ? "Disable" : "Enable"}
                  </SubmitButton>
                </form>
                <form action={deleteAlertChannel.bind(null, c.id)}>
                  <SubmitButton variant="ghost" pendingText="…" confirm="Remove this alert channel?">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <AlertChannelForm action={addAlertChannel.bind(null, projectId)} />
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <h2 className="font-semibold text-red-600">Danger zone</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          Deletes the project, all its monitors, history and the public status page.
        </p>
        <form action={deleteProject.bind(null, projectId)}>
          <SubmitButton variant="danger" pendingText="Deleting…" confirm={`Delete "${project.name}" permanently?`}>
            Delete project
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
