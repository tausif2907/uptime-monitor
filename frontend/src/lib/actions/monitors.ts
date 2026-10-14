"use server";

import { prisma } from "@uptime/database";
import { MAX_MONITORS_PER_PROJECT, monitorInputSchema, type MonitorInput } from "@uptime/shared";
import { assertSafeUrl, SsrfError } from "@uptime/shared/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZodError, type FormState } from "@/lib/form-state";
import { scheduleMonitor, unscheduleMonitor } from "@/lib/schedule";
import { requireMonitor, requireProject } from "@/lib/session";

const allowPrivate = process.env.ALLOW_PRIVATE_TARGETS === "true";

/** Zod for shape, then the SSRF guard (DNS lookup) for where the URL actually points. */
async function parseMonitorForm(
  formData: FormData,
): Promise<{ data: MonitorInput; state?: never } | { data?: never; state: FormState }> {
  const parsed = monitorInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { state: fromZodError(parsed.error) };
  try {
    await assertSafeUrl(parsed.data.url, { allowPrivate });
  } catch (err) {
    if (err instanceof SsrfError) return { state: { fieldErrors: { url: [err.message] } } };
    throw err;
  }
  return { data: parsed.data };
}

export async function createMonitor(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProject(projectId);
  const result = await parseMonitorForm(formData);
  if (!result.data) return result.state;

  const count = await prisma.monitor.count({ where: { projectId } });
  if (count >= MAX_MONITORS_PER_PROJECT) {
    return { error: `A project can have at most ${MAX_MONITORS_PER_PROJECT} monitors.` };
  }

  const monitor = await prisma.monitor.create({ data: { ...result.data, projectId } });
  await scheduleMonitor(monitor);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/monitors/${monitor.id}`);
}

export async function updateMonitor(
  monitorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { monitor: existing } = await requireMonitor(monitorId);
  const result = await parseMonitorForm(formData);
  if (!result.data) return result.state;

  const targetChanged =
    existing.url !== result.data.url ||
    existing.method !== result.data.method ||
    existing.expectedStatus !== result.data.expectedStatus;

  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    // A new target starts fresh rather than inheriting the old one's failure streak.
    data: targetChanged
      ? { ...result.data, status: "PENDING", consecutiveFailures: 0 }
      : result.data,
  });
  await scheduleMonitor(monitor);

  revalidatePath(`/projects/${monitor.projectId}`, "layout");
  redirect(`/projects/${monitor.projectId}/monitors/${monitor.id}`);
}

export async function togglePauseMonitor(monitorId: string): Promise<void> {
  const { monitor: existing } = await requireMonitor(monitorId);
  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    data: { isPaused: !existing.isPaused },
  });
  await scheduleMonitor(monitor);
  revalidatePath(`/projects/${monitor.projectId}`, "layout");
}

export async function deleteMonitor(monitorId: string): Promise<void> {
  const { monitor } = await requireMonitor(monitorId);
  await prisma.monitor.delete({ where: { id: monitorId } });
  await unscheduleMonitor(monitorId);
  revalidatePath(`/projects/${monitor.projectId}`, "layout");
  redirect(`/projects/${monitor.projectId}`);
}
