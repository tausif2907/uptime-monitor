import { prisma } from "@uptime/database";
import { formatUptime } from "@uptime/shared";
import { Activity, ArrowDownCircle, ArrowUpCircle, FolderPlus, Gauge, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectForm } from "@/components/forms/project-form";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { createProject } from "@/lib/actions/projects";
import { requireUser } from "@/lib/session";
import { getUptime24h } from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      monitors: { select: { id: true, name: true, status: true, isPaused: true, lastCheckedAt: true } },
      alertChannels: { where: { isEnabled: true }, select: { id: true } },
    },
  });

  const monitors = projects.flatMap((p) => p.monitors);
  const active = monitors.filter((m) => !m.isPaused);
  const up = active.filter((m) => m.status === "UP").length;
  const down = active.filter((m) => m.status === "DOWN").length;
  const uptime = await getUptime24h(active.map((m) => m.id));
  const values = [...uptime.values()].filter((v): v is number => v !== null);
  const avgUptime = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hi ${firstName} 👋` : "Your dashboard"}
        description={
          down > 0 ? (
            <span className="font-medium text-red-600">{down} monitor{down === 1 ? " is" : "s are"} down right now.</span>
          ) : active.length > 0 ? (
            "Everything is up. We'll email you if that changes."
          ) : (
            "Add a website and we'll start watching it within a minute."
          )
        }
      />

      <OnboardingChecklist
        hasProject={projects.length > 0}
        hasMonitor={monitors.length > 0}
        hasCheck={monitors.some((m) => m.lastCheckedAt)}
        hasAlerts={projects.some((p) => p.alertChannels.length > 0)}
        firstProjectId={projects[0]?.id}
        firstSlug={projects[0]?.slug}
      />

      {monitors.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Monitors" value={monitors.length} icon={<Activity className="h-4 w-4" />} />
          <Stat label="Up" value={up} icon={<ArrowUpCircle className="h-4 w-4" />} tone="up" />
          <Stat label="Down" value={down} icon={<ArrowDownCircle className="h-4 w-4" />} tone={down ? "down" : "neutral"} />
          <Stat label="Avg uptime 24h" value={formatUptime(avgUptime)} icon={<Gauge className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Projects</h2>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" icon={<FolderPlus className="h-6 w-6" />}>
              Create your first project on the right — e.g. “My websites”.
            </EmptyState>
          ) : (
            projects.map((project, i) => {
              const projectActive = project.monitors.filter((m) => !m.isPaused);
              const projectDown = projectActive.filter((m) => m.status === "DOWN").length;
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="block animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <Card className="group flex items-center gap-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${projectDown ? "bg-red-50 text-red-600 dark:bg-red-950" : "bg-brand-50 text-brand-600 dark:bg-brand-600/10"}`}>
                      <Globe className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-400">{project.name}</p>
                      <p className="truncate text-sm text-zinc-500">/status/{project.slug}</p>
                    </div>
                    <div className="hidden gap-1 sm:flex">
                      {project.monitors.slice(0, 8).map((m) => (
                        <span
                          key={m.id}
                          title={`${m.name}: ${m.isPaused ? "paused" : m.status.toLowerCase()}`}
                          className={`h-2.5 w-2.5 rounded-full ${m.isPaused ? "bg-degraded" : m.status === "UP" ? "bg-up" : m.status === "DOWN" ? "bg-down" : "bg-pending"}`}
                        />
                      ))}
                    </div>
                    <div className="w-24 text-right text-sm">
                      <p className={projectDown ? "font-semibold text-red-600" : "font-medium text-emerald-600"}>
                        {projectDown ? `${projectDown} down` : projectActive.length ? "All up" : "No monitors"}
                      </p>
                      <p className="text-xs text-zinc-500">{project.monitors.length} monitor{project.monitors.length === 1 ? "" : "s"}</p>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </section>

        <Card id="new-project" className="h-fit scroll-mt-24">
          <h2 className="mb-1 font-semibold">New project</h2>
          <p className="mb-4 text-sm text-zinc-500">Group websites together, e.g. “Portfolio” or “Client: Acme”.</p>
          <ProjectForm action={createProject} />
        </Card>
      </div>
    </>
  );
}
