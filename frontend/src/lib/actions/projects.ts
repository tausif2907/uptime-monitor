"use server";

import { isUniqueViolation, prisma } from "@uptime/database";
import { MAX_PROJECTS_PER_USER, projectInputSchema, slugify } from "@uptime/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZodError, type FormState } from "@/lib/form-state";
import { unscheduleMonitor } from "@/lib/schedule";
import { requireProject, requireUser } from "@/lib/session";

function readProjectForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  return projectInputSchema.safeParse({ name, slug });
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);

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
        // Alert the owner by email out of the box.
        alertChannels: { create: { type: "EMAIL", target: user.email } },
      },
    });
    projectId = project.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { fieldErrors: { slug: ["That status page URL is taken — try another slug."] } };
    }
    throw err;
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}`);
}

export async function updateProject(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProject(projectId);
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await prisma.project.update({ where: { id: projectId }, data: parsed.data });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { fieldErrors: { slug: ["That status page URL is taken — try another slug."] } };
    }
    throw err;
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  return { message: "Saved" };
}

export async function deleteProject(projectId: string): Promise<void> {
  await requireProject(projectId);
  const monitors = await prisma.monitor.findMany({ where: { projectId }, select: { id: true } });
  await prisma.project.delete({ where: { id: projectId } });
  await Promise.all(monitors.map((m) => unscheduleMonitor(m.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
