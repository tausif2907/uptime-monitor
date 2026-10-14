"use server";

import { isUniqueViolation, prisma } from "@uptime/database";
import { MAX_PROJECTS_PER_USER, projectInputSchema, slugify } from "@uptime/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_READ_ONLY_MESSAGE, isDemoEmail, isReadOnlyForDemo } from "@/lib/demo";
import { fromZodError, type FormState } from "@/lib/form-state";
import { consume, retryMessage } from "@/lib/rate-limit";
import { unscheduleMonitor } from "@/lib/schedule";
import { requireProject, requireUser } from "@/lib/session";

// Public status-page slugs nobody may claim (impersonation / confusion on our own domain).
const RESERVED_SLUGS = new Set(["demo", "admin", "api", "app", "status", "login", "signup", "help", "guide", "support", "www", "security"]);

const SLUG_TAKEN = "That status page URL is taken — try another slug.";

function readProjectForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  return projectInputSchema.safeParse({ name, slug });
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);
  if (RESERVED_SLUGS.has(parsed.data.slug)) return { fieldErrors: { slug: [SLUG_TAKEN] } };

  const limit = await consume([{ key: `project-create:${user.id}`, limit: 10, windowSec: 60 * 60 }]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const count = await prisma.project.count({ where: { ownerId: user.id } });
  if (count >= MAX_PROJECTS_PER_USER) {
    return { error: `You can have at most ${MAX_PROJECTS_PER_USER} projects.` };
  }

  let projectId: string;
  try {
    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        ownerId: user.id,
        // Alert the owner by email out of the box (not on the shared demo account).
        ...(isDemoEmail(user.email)
          ? {}
          : { alertChannels: { create: { type: "EMAIL", target: user.email } } }),
      },
    });
    projectId = project.id;
  } catch (err) {
    if (isUniqueViolation(err)) return { fieldErrors: { slug: [SLUG_TAKEN] } };
    throw err;
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}?toast=project-created`);
}

export async function updateProject(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, project } = await requireProject(projectId);
  if (isReadOnlyForDemo(user, project)) return { error: DEMO_READ_ONLY_MESSAGE };
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.slug !== project.slug && RESERVED_SLUGS.has(parsed.data.slug)) {
    return { fieldErrors: { slug: [SLUG_TAKEN] } };
  }

  try {
    await prisma.project.update({ where: { id: projectId }, data: parsed.data });
  } catch (err) {
    if (isUniqueViolation(err)) return { fieldErrors: { slug: [SLUG_TAKEN] } };
    throw err;
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  return { message: "Project saved." };
}

export async function deleteProject(projectId: string): Promise<FormState> {
  const { user, project } = await requireProject(projectId);
  if (isReadOnlyForDemo(user, project)) return { error: DEMO_READ_ONLY_MESSAGE };
  const monitors = await prisma.monitor.findMany({ where: { projectId }, select: { id: true } });
  await prisma.project.delete({ where: { id: projectId } });
  await Promise.all(monitors.map((m) => unscheduleMonitor(m.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard?toast=project-deleted");
}
