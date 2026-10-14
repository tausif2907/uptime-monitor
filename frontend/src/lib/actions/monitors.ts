"use server";

import { prisma } from "@uptime/database";
import {
  httpUrlSchema,
  JOBS,
  MAX_MONITORS_PER_PROJECT,
  monitorInputSchema,
  type MonitorInput,
} from "@uptime/shared";
import { assertSafeUrl, getChecksQueue, performCheck, SsrfError, type CheckOutput } from "@uptime/shared/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_READ_ONLY_MESSAGE, isReadOnlyForDemo } from "@/lib/demo";
import { fromZodError, type FormState } from "@/lib/form-state";
import { consume, retryMessage } from "@/lib/rate-limit";
import { scheduleMonitor, unscheduleMonitor } from "@/lib/schedule";
import { requireMonitor, requireProject, requireUser } from "@/lib/session";

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

/** Monitor writes per user: generous for humans, stops scripted abuse. */
async function writeLimit(userId: string) {
  return consume([{ key: `monitor-write:${userId}`, limit: 30, windowSec: 10 * 60 }]);
}

export async function createMonitor(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, project } = await requireProject(projectId);
  if (isReadOnlyForDemo(user, project)) return { error: DEMO_READ_ONLY_MESSAGE };
  const limit = await writeLimit(user.id);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const result = await parseMonitorForm(formData);
  if (!result.data) return result.state;

  const count = await prisma.monitor.count({ where: { projectId } });
  if (count >= MAX_MONITORS_PER_PROJECT) {
    return { error: `A project can have at most ${MAX_MONITORS_PER_PROJECT} monitors.` };
  }
  const duplicate = await prisma.monitor.findFirst({
    where: { projectId, url: result.data.url, method: result.data.method },
  });
  if (duplicate) {
    return { fieldErrors: { url: [`You're already monitoring this URL as "${duplicate.name}".`] } };
  }

  const monitor = await prisma.monitor.create({ data: { ...result.data, projectId } });
  await scheduleMonitor(monitor);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/monitors/${monitor.id}?toast=monitor-created`);
}

export async function updateMonitor(
  monitorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, monitor: existing } = await requireMonitor(monitorId);
  if (isReadOnlyForDemo(user, existing.project)) return { error: DEMO_READ_ONLY_MESSAGE };
  const limit = await writeLimit(user.id);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const result = await parseMonitorForm(formData);
  if (!result.data) return result.state;

  const targetChanged =
    existing.url !== result.data.url ||
    existing.method !== result.data.method ||
    existing.expectedStatus !== result.data.expectedStatus;

  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    // A new target starts fresh rather than inheriting the old one's failure streak.
    data: targetChanged ? { ...result.data, status: "PENDING", consecutiveFailures: 0 } : result.data,
  });
  await scheduleMonitor(monitor);

  revalidatePath(`/projects/${monitor.projectId}`, "layout");
  redirect(`/projects/${monitor.projectId}/monitors/${monitor.id}?toast=monitor-saved`);
}

export async function togglePauseMonitor(monitorId: string): Promise<FormState> {
  const { user, monitor: existing } = await requireMonitor(monitorId);
  if (isReadOnlyForDemo(user, existing.project)) return { error: DEMO_READ_ONLY_MESSAGE };
  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    data: { isPaused: !existing.isPaused },
  });
  await scheduleMonitor(monitor);
  revalidatePath(`/projects/${monitor.projectId}`, "layout");
  return { message: monitor.isPaused ? "Monitoring paused." : "Monitoring resumed." };
}

export async function deleteMonitor(monitorId: string): Promise<FormState> {
  const { user, monitor } = await requireMonitor(monitorId);
  if (isReadOnlyForDemo(user, monitor.project)) return { error: DEMO_READ_ONLY_MESSAGE };
  await prisma.monitor.delete({ where: { id: monitorId } });
  await unscheduleMonitor(monitorId);
  revalidatePath(`/projects/${monitor.projectId}`, "layout");
  redirect(`/projects/${monitor.projectId}?toast=monitor-deleted`);
}

/** Queue an immediate check (in addition to the regular schedule). */
export async function checkNow(monitorId: string): Promise<FormState> {
  const { user, monitor } = await requireMonitor(monitorId);
  if (monitor.isPaused) return { error: "Resume the monitor first." };
  const limit = await consume([{ key: `check-now:${user.id}`, limit: 6, windowSec: 60 }]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };
  try {
    // jobId de-duplicates double clicks within the same 10 s window.
    await getChecksQueue().add(
      JOBS.check,
      { monitorId },
      { jobId: `manual-${monitorId}-${Math.floor(Date.now() / 10_000)}`, removeOnComplete: true, removeOnFail: 100 },
    );
  } catch {
    return { error: "Couldn't reach the check queue. Is the worker's Redis running?" };
  }
  return { message: "Check queued — results appear in a few seconds." };
}

export type TestUrlResult = { result?: CheckOutput; error?: string };

/** Run a one-off check from the monitor form, before saving, so users see what we'll see. */
export async function testUrl(formData: FormData): Promise<TestUrlResult> {
  const user = await requireUser();
  const limit = await consume([{ key: `test-url:${user.id}`, limit: 10, windowSec: 60 }]);
  if (limit.blocked) return { error: retryMessage(limit.retryAfterSec) };

  const url = httpUrlSchema.safeParse(formData.get("url"));
  if (!url.success) return { error: url.error.issues[0]?.message ?? "Enter a valid URL" };
  const parsed = monitorInputSchema.safeParse({ ...Object.fromEntries(formData), name: "test" });
  const settings = parsed.success
    ? parsed.data
    : { method: "GET" as const, timeoutMs: 10_000, expectedStatus: 200 };

  const result = await performCheck(
    { url: url.data, method: settings.method, timeoutMs: settings.timeoutMs, expectedStatus: settings.expectedStatus },
    { allowPrivate },
  );
  return { result };
}
