import { prisma, type AlertChannel, type NotificationEvent } from "@uptime/database";
import { assertSafeUrl } from "@uptime/shared/server";
import { config } from "./config";
import { sendEmail } from "./email";
import { errorMessage, logger } from "./logger";

export interface IncidentContext {
  incidentId: string;
  event: NotificationEvent;
  projectId: string;
  monitor: { id: string; name: string; url: string };
  cause: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
}

/**
 * Exactly-once alerts: for each channel we INSERT the Notification row first. The unique
 * (incidentId, channelId, event) constraint means a retried job or a second worker loses the
 * race and skips sending. Only the winner delivers, then records SENT or FAILED.
 */
export async function notifyIncident(ctx: IncidentContext): Promise<void> {
  const channels = await prisma.alertChannel.findMany({
    where: { projectId: ctx.projectId, isEnabled: true },
  });

  for (const channel of channels) {
    const key = { incidentId: ctx.incidentId, channelId: channel.id, event: ctx.event };
    // INSERT ... ON CONFLICT DO NOTHING: count is 0 if another job already claimed this alert.
    const { count } = await prisma.notification.createMany({ data: [key], skipDuplicates: true });
    if (count === 0) continue;
    const { id: notificationId } = await prisma.notification.findUniqueOrThrow({
      where: { incidentId_channelId_event: key },
      select: { id: true },
    });

    try {
      await deliver(channel, ctx);
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (err) {
      logger.warn("alert delivery failed", { channelId: channel.id, error: errorMessage(err) });
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED", error: errorMessage(err).slice(0, 500) },
      });
    }
  }
}

function buildMessage(ctx: IncidentContext) {
  const link = `${config.appUrl}/projects/${ctx.projectId}/monitors/${ctx.monitor.id}`;
  if (ctx.event === "OPENED") {
    return {
      subject: `[DOWN] ${ctx.monitor.name} is down`,
      text: [
        `${ctx.monitor.name} (${ctx.monitor.url}) is DOWN.`,
        `Cause: ${ctx.cause ?? "unknown"}`,
        `Started: ${ctx.startedAt.toISOString()}`,
        "",
        `Details: ${link}`,
      ].join("\n"),
    };
  }
  const minutes = Math.max(
    1,
    Math.round(((ctx.resolvedAt ?? new Date()).getTime() - ctx.startedAt.getTime()) / 60_000),
  );
  return {
    subject: `[RESOLVED] ${ctx.monitor.name} is back up`,
    text: [
      `${ctx.monitor.name} (${ctx.monitor.url}) is back UP after ~${minutes} min.`,
      `Down since: ${ctx.startedAt.toISOString()}`,
      "",
      `Details: ${link}`,
    ].join("\n"),
  };
}

async function deliver(channel: AlertChannel, ctx: IncidentContext): Promise<void> {
  const message = buildMessage(ctx);

  if (channel.type === "EMAIL") {
    await sendEmail({ to: channel.target, ...message });
    return;
  }

  // WEBHOOK: `text` works for Slack incoming webhooks, `content` for Discord.
  await assertSafeUrl(channel.target, { allowPrivate: config.allowPrivateTargets });
  const summary = `${message.subject}\n${message.text}`;
  const res = await fetch(channel.target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
    body: JSON.stringify({
      text: summary,
      content: summary,
      event: ctx.event,
      monitor: ctx.monitor,
      incident: {
        id: ctx.incidentId,
        cause: ctx.cause,
        startedAt: ctx.startedAt,
        resolvedAt: ctx.resolvedAt,
      },
    }),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
}
