import { prisma } from "@uptime/database";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectForm } from "@/components/forms/project-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { createProject } from "@/lib/actions/projects";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: { monitors: { select: { status: true, isPaused: true } } },
  });

  return (
    <>
      <PageHeader title="Projects" description="Each project groups monitors and has its own status page." />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          {projects.length === 0 ? (
            <EmptyState title="No projects yet">Create your first project to start adding monitors.</EmptyState>
          ) : (
            projects.map((project) => {
              const active = project.monitors.filter((m) => !m.isPaused);
              const down = active.filter((m) => m.status === "DOWN").length;
              const up = active.filter((m) => m.status === "UP").length;
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="block">
                  <Card className="flex items-center justify-between gap-4 transition hover:border-zinc-400">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="text-sm text-zinc-500">/status/{project.slug}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className={down > 0 ? "font-medium text-red-600" : "text-green-600"}>
                        {down > 0 ? `${down} down` : active.length > 0 ? "All up" : "No monitors"}
                      </p>
                      <p className="text-zinc-500">
                        {up}/{project.monitors.length} up
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </section>

        <Card>
          <h2 className="mb-4 font-semibold">New project</h2>
          <ProjectForm action={createProject} />
        </Card>
      </div>
    </>
  );
}
