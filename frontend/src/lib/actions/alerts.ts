"use server";

import { prisma } from "@uptime/database";
import { alertChannelInputSchema } from "@uptime/shared";
import { assertSafeUrl, SsrfError } from "@uptime/shared/server";
import { revalidatePath } from "next/cache";
import { randomToken } from "@/lib/crypto";
import { DEMO_NO_ALERTS_MESSAGE, isDemoEmail } from "@/lib/demo";
import { fromZodError, type FormState } from "@/lib/form-state";
import { requireProject, requireUser } from "@/lib/session";

const MAX_CHANNELS_PER_PROJECT = 10;

export async function addAlertChannel(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireProject(projectId);
  if (isDemoEmail(user.email)) return { error: DEMO_NO_ALERTS_MESSAGE };

  const parsed = alertChannelInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const count = await prisma.alertChannel.count({ where: { projectId } });
  if (count >= MAX_CHANNELS_PER_PROJECT) {
    return { error: `A project can have at most ${MAX_CHANNELS_PER_PROJECT} alert channels.` };
  }

  if (parsed.data.type === "EMAIL" && parsed.data.target !== user.email.toLowerCase()) {
    // Otherwise anyone could make our servers email arbitrary people (spam relay).
    return {
      fieldErrors: {
        target: [`For now, email alerts can only go to your own verified address (${user.email}).`],
      },
    };
  }

  let secret: string | null = null;
  if (parsed.data.type === "WEBHOOK") {
    try {
      await assertSafeUrl(parsed.data.target, {
        allowPrivate: process.env.ALLOW_PRIVATE_TARGETS === "true",
      });
    } catch (err) {
      if (err instanceof SsrfError) return { fieldErrors: { target: [err.message] } };
      throw err;
    }
    secret = `whsec_${randomToken(24)}`;
  }

  const exists = await prisma.alertChannel.findFirst({
    where: { projectId, type: parsed.data.type, target: parsed.data.target },
  });
  if (exists) return { fieldErrors: { target: ["This channel already exists."] } };

  await prisma.alertChannel.create({ data: { ...parsed.data, secret, projectId } });
  revalidatePath(`/projects/${projectId}/settings`);
  return { message: parsed.data.type === "WEBHOOK" ? "Webhook added — copy its signing secret below." : "Email alerts added." };
}

/** Channel owned by the current user (IDOR-safe), or throw. */
async function requireChannel(channelId: string) {
  const user = await requireUser();
  const channel = await prisma.alertChannel.findFirst({
    where: { id: channelId, project: { ownerId: user.id } },
  });
  if (!channel) throw new Error("Alert channel not found");
  return { user, channel };
}

export async function toggleAlertChannel(channelId: string): Promise<FormState> {
  const { user, channel } = await requireChannel(channelId);
  if (isDemoEmail(user.email)) return { error: DEMO_NO_ALERTS_MESSAGE };
  await prisma.alertChannel.update({
    where: { id: channelId },
    data: { isEnabled: !channel.isEnabled },
  });
  revalidatePath(`/projects/${channel.projectId}/settings`);
  return { message: channel.isEnabled ? "Channel paused." : "Channel enabled." };
}

export async function deleteAlertChannel(channelId: string): Promise<FormState> {
  const { user, channel } = await requireChannel(channelId);
  if (isDemoEmail(user.email)) return { error: DEMO_NO_ALERTS_MESSAGE };
  await prisma.alertChannel.delete({ where: { id: channelId } });
  revalidatePath(`/projects/${channel.projectId}/settings`);
  return { message: "Channel removed." };
}
