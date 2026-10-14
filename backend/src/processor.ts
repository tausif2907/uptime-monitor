import { prisma, type Incident } from "@uptime/database";
import { nextState } from "@uptime/shared";
import { performCheck } from "@uptime/shared/server";
import { config } from "./config";
import { notifyIncident } from "./notifier";

export type ProcessResult =
  | { skipped: "not_found" | "paused" }
  | { skipped?: undefined; ok: boolean; action: ReturnType<typeof nextState>["action"] };

/**
 * Handle one scheduled check for a monitor:
 *   1. run the HTTP check
 *   2. in ONE transaction: save the CheckResult, update the monitor's denormalised status,
 *      and open/resolve the incident — so state and incidents can never disagree
 *   3. after commit, send alerts (exactly-once via the Notification unique constraint)
 */
export async function processCheck(monitorId: string): Promise<ProcessResult> {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) return { skipped: "not_found" };
  if (monitor.isPaused) return { skipped: "paused" };

  const result = await performCheck(monitor, { allowPrivate: config.allowPrivateTargets });
  const now = new Date();
  const next = nextState(monitor, result);

  const incident = await prisma.$transaction(async (tx): Promise<Incident | null> => {
    await tx.checkResult.create({
      data: {
        monitorId,
        checkedAt: now,
        ok: result.ok,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error?.slice(0, 500) ?? null,
      },
    });

    await tx.monitor.update({
      where: { id: monitorId },
      data: {
        status: next.status,
        consecutiveFailures: next.consecutiveFailures,
        lastCheckedAt: now,
        lastResponseTimeMs: result.responseTimeMs,
      },
    });

    if (next.action === "OPEN_INCIDENT") {
      // ON CONFLICT DO NOTHING: the partial unique index allows only one open incident.
      await tx.incident.createMany({
        data: [{ monitorId, startedAt: now, cause: result.error?.slice(0, 500) ?? null }],
        skipDuplicates: true,
      });
      return tx.incident.findFirst({ where: { monitorId, resolvedAt: null } });
    }

    if (next.action === "RESOLVE_INCIDENT") {
      const open = await tx.incident.findFirst({ where: { monitorId, resolvedAt: null } });
      if (!open) return null;
      return tx.incident.update({ where: { id: open.id }, data: { resolvedAt: now } });
    }

    return null;
  });

  if (incident && next.action) {
    await notifyIncident({
      incidentId: incident.id,
      event: next.action === "OPEN_INCIDENT" ? "OPENED" : "RESOLVED",
      projectId: monitor.projectId,
      monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
      cause: incident.cause,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
    });
  }

  return { ok: result.ok, action: next.action };
}
