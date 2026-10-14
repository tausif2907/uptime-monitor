import { prisma } from "@uptime/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notifyIncident } from "../src/notifier";
import { processCheck } from "../src/processor";
import { startMockServer, type MockServer } from "./mock-server";

/**
 * Full pipeline against a real Postgres: check -> state -> incident -> notification.
 * Skipped when DATABASE_URL is not set (CI provides a Postgres service container).
 */
describe.skipIf(!process.env.DATABASE_URL)("processCheck (Postgres)", () => {
  let server: MockServer;
  let userId: string;
  let monitorId: string;

  beforeAll(async () => {
    server = await startMockServer();
    const user = await prisma.user.create({
      data: { email: `processor-test-${Date.now()}@uptime.local` },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        name: "Processor test",
        slug: `processor-test-${Date.now()}`,
        ownerId: user.id,
        alertChannels: { create: { type: "EMAIL", target: user.email } },
      },
    });
    const monitor = await prisma.monitor.create({
      data: { projectId: project.id, name: "Toggle", url: `${server.url}/toggle`, timeoutMs: 2000 },
    });
    monitorId = monitor.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await server.close();
    await prisma.$disconnect();
  });

  const monitor = () => prisma.monitor.findUniqueOrThrow({ where: { id: monitorId } });
  const incidents = () => prisma.incident.findMany({ where: { monitorId } });
  const notifications = () =>
    prisma.notification.findMany({ where: { incident: { monitorId } }, orderBy: { createdAt: "asc" } });

  it("first success marks the monitor UP", async () => {
    server.state.toggleStatus = 200;
    expect(await processCheck(monitorId)).toMatchObject({ ok: true, action: null });
    expect((await monitor()).status).toBe("UP");
  });

  it("one failure is not an outage", async () => {
    server.state.toggleStatus = 500;
    expect(await processCheck(monitorId)).toMatchObject({ ok: false, action: null });
    expect(await monitor()).toMatchObject({ status: "UP", consecutiveFailures: 1 });
    expect(await incidents()).toHaveLength(0);
  });

  it("second consecutive failure opens one incident and sends one alert", async () => {
    expect(await processCheck(monitorId)).toMatchObject({ action: "OPEN_INCIDENT" });
    expect((await monitor()).status).toBe("DOWN");
    const open = await incidents();
    expect(open).toHaveLength(1);
    expect(open[0]?.resolvedAt).toBeNull();
    expect(open[0]?.cause).toBe("Expected status 200, got 500");

    const sent = await notifications();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: "OPENED", status: "SENT" });
  });

  it("further failures do not open another incident", async () => {
    await processCheck(monitorId);
    expect(await incidents()).toHaveLength(1);
  });

  it("a retried/duplicate alert for the same event is never sent twice", async () => {
    const [incident] = await incidents();
    const m = await monitor();
    await notifyIncident({
      incidentId: incident!.id,
      event: "OPENED",
      projectId: m.projectId,
      monitor: { id: m.id, name: m.name, url: m.url },
      cause: incident!.cause,
      startedAt: incident!.startedAt,
      resolvedAt: null,
    });
    expect(await notifications()).toHaveLength(1);
  });

  it("the next success resolves the incident and sends a RESOLVED alert", async () => {
    server.state.toggleStatus = 200;
    expect(await processCheck(monitorId)).toMatchObject({ ok: true, action: "RESOLVE_INCIDENT" });
    expect(await monitor()).toMatchObject({ status: "UP", consecutiveFailures: 0 });
    const [incident] = await incidents();
    expect(incident?.resolvedAt).not.toBeNull();
    expect((await notifications()).map((n) => n.event)).toEqual(["OPENED", "RESOLVED"]);
  });

  it("stores every check result", async () => {
    expect(await prisma.checkResult.count({ where: { monitorId } })).toBe(5);
  });
});
