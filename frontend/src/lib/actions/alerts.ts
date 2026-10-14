"use server";

import { prisma } from "@uptime/database";
import { alertChannelInputSchema } from "@uptime/shared";
import { assertSafeUrl, SsrfError } from "@uptime/shared/server";
import { revalidatePath } from "next/cache";
import { fromZodError, type FormState } from "@/lib/form-state";
import { requireProject, requireUser } from "@/lib/session";

export async function addAlertChannel(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProject(projectId);
  const parsed = alertChannelInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  if (parsed.data.type === "WEBHOOK") {
    try {
      await assertSafeUrl(parsed.data.target, {
        allowPrivate: process.env.ALLOW_PRIVATE_TARGETS === "true",
      });
    } catch (err) {
      if (err instanceof SsrfError) return { fieldErrors: { target: [err.message] } };
      throw err;
    }
  }

  await prisma.alertChannel.create({ data: { ...parsed.data, projectId } });
  revalidatePath(`/projects/${projectId}/settings`);
  return {};
}

async function requireChannel(channelId: string) {
  const user = await requireUser();
  return prisma.alertChannel.findFirstOrThrow({
    where: { id: channelId, project: { ownerId: user.id } },
  });
}

export async function toggleAlertChannel(channelId: string): Promise<void> {
  const channel = await requireChannel(channelId);
  await prisma.alertChannel.update({
    where: { id: channelId },
    data: { isEnabled: !channel.isEnabled },
  });
  revalidatePath(`/projects/${channel.projectId}/settings`);
}

export async function deleteAlertChannel(channelId: string): Promise<void> {
  const channel = await requireChannel(channelId);
  await prisma.alertChannel.delete({ where: { id: channelId } });
  revalidatePath(`/projects/${channel.projectId}/settings`);
}
