import { prisma } from "@uptime/database";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";

/** The signed-in user, or a redirect to /login. */
export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  return user;
}

/** A project owned by the current user, or 404 (never leak that another user's project exists). */
export async function requireProject(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: user.id } });
  if (!project) notFound();
  return { user, project };
}

/** A monitor inside a project owned by the current user, or 404. */
export async function requireMonitor(monitorId: string) {
  const user = await requireUser();
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, project: { ownerId: user.id } },
    include: { project: true },
  });
  if (!monitor) notFound();
  return { user, monitor };
}
