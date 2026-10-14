import { prisma } from "@uptime/database";
import { Bell, Mail, Trash2, Webhook } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { CopyButton } from "@/components/copy-button";
import { AlertChannelForm } from "@/components/forms/alert-channel-form";
import { ProjectForm } from "@/components/forms/project-form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { addAlertChannel, deleteAlertChannel, toggleAlertChannel } from "@/lib/actions/alerts";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import { DEMO_NO_ALERTS_MESSAGE, isDemoEmail, isReadOnlyForDemo } from "@/lib/demo";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project } = await requireProject(projectId);
  const readOnly = isReadOnlyForDemo(user, project);
  const demo = isDemoEmail(user.email);
  const channels = await prisma.alertChannel.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description={<Link href={`/projects/${projectId}`} className="hover:text-brand-600">← {project.name}</Link>}
      />

      <Card>
        <h2 className="font-semibold">Project details</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">Rename the project or change its public status page address.</p>
        {readOnly ? (
          <Alert tone="info">The sample Demo Project is read-only.</Alert>
        ) : (
          <ProjectForm action={updateProject.bind(null, projectId)} defaults={{ name: project.name, slug: project.slug }} submitLabel="Save changes" />
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold">Alerts</h2>
        </div>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          Each enabled channel gets <b>one</b> message when an incident opens (after 2 failed checks in a row) and{" "}
          <b>one</b> when it resolves. <Link href="/help#alerts" className="text-brand-600 hover:underline">How alerts work →</Link>
        </p>

        {demo && <Alert tone="warning" className="mb-4">{DEMO_NO_ALERTS_MESSAGE}</Alert>}

        <ul className="mb-6 space-y-2">
          {channels.length === 0 && (
            <li className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No alert channels yet — you won&apos;t be notified when something breaks.
            </li>
          )}
          {channels.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {c.type === "EMAIL" ? <Mail className="h-4 w-4" /> : <Webhook className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${c.isEnabled ? "" : "text-zinc-400 line-through"}`}>{c.target}</p>
                    <p className="text-xs text-zinc-500">{c.type === "EMAIL" ? "Email" : "Webhook"}{!c.isEnabled && " · paused"}</p>
                  </div>
                </div>
                {!demo && (
                  <div className="flex shrink-0 gap-2">
                    <ActionButton action={toggleAlertChannel.bind(null, c.id)} variant="ghost">
                      {c.isEnabled ? "Pause" : "Enable"}
                    </ActionButton>
                    <ActionButton action={deleteAlertChannel.bind(null, c.id)} variant="ghost" confirm="Remove this alert channel?">
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  </div>
                )}
              </div>
              {c.type === "WEBHOOK" && c.secret && (
                <details className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
                  <summary className="cursor-pointer font-medium">Signing secret (verify our requests)</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="break-all rounded bg-white px-2 py-1 dark:bg-zinc-950">{c.secret}</code>
                    <CopyButton value={c.secret} />
                  </div>
                  <p className="mt-2 text-zinc-500">
                    Every request carries <Badge>X-Uptime-Signature: t=…,v1=…</Badge> — an HMAC-SHA256 of <code>t.body</code> with this secret.{" "}
                    <Link href="/help#webhooks" className="text-brand-600 hover:underline">How to verify →</Link>
                  </p>
                </details>
              )}
            </li>
          ))}
        </ul>
        {!demo && <AlertChannelForm action={addAlertChannel.bind(null, projectId)} defaultEmail={user.email} />}
      </Card>

      {!readOnly && (
        <Card className="border-red-200 dark:border-red-900/60">
          <h2 className="font-semibold text-red-600">Danger zone</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-500">Deletes the project, all its monitors, history and the public status page. This can&apos;t be undone.</p>
          <ActionButton action={deleteProject.bind(null, projectId)} variant="danger" confirm={`Delete "${project.name}" permanently?`}>
            <Trash2 className="h-4 w-4" /> Delete project
          </ActionButton>
        </Card>
      )}
    </div>
  );
}
