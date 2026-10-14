import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performCheck, type CheckTarget } from "@uptime/shared/server";
import { startMockServer, type MockServer } from "./mock-server";

let server: MockServer;

beforeAll(async () => {
  server = await startMockServer();
});
afterAll(async () => {
  await server.close();
});

const target = (path: string, overrides: Partial<CheckTarget> = {}): CheckTarget => ({
  url: `${server.url}${path}`,
  method: "GET",
  timeoutMs: 2000,
  expectedStatus: 200,
  ...overrides,
});

// The mock server is on 127.0.0.1, so these tests opt out of the SSRF IP check.
const opts = { allowPrivate: true };

describe("performCheck against a local mock server", () => {
  it("200 -> ok", async () => {
    const result = await performCheck(target("/ok"), opts);
    expect(result).toMatchObject({ ok: true, statusCode: 200, error: null });
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("500 -> failure with a readable error", async () => {
    const result = await performCheck(target("/error"), opts);
    expect(result).toMatchObject({
      ok: false,
      statusCode: 500,
      error: "Expected status 200, got 500",
    });
  });

  it("slow but within the timeout -> ok, response time recorded", async () => {
    const result = await performCheck(target("/slow"), opts);
    expect(result.ok).toBe(true);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(250);
  });

  it("hung server -> times out at timeoutMs instead of hanging the worker", async () => {
    const started = Date.now();
    const result = await performCheck(target("/hang", { timeoutMs: 500 }), opts);
    expect(result).toMatchObject({ ok: false, statusCode: null, error: "Timed out after 500 ms" });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("follows redirects", async () => {
    const result = await performCheck(target("/redirect"), opts);
    expect(result).toMatchObject({ ok: true, statusCode: 200 });
  });

  it("does not follow redirects when a 3xx is expected", async () => {
    const result = await performCheck(target("/redirect", { expectedStatus: 302 }), opts);
    expect(result).toMatchObject({ ok: true, statusCode: 302 });
  });

  it("gives up on redirect loops", async () => {
    const result = await performCheck(target("/loop"), opts);
    expect(result).toMatchObject({ ok: false, error: "Too many redirects" });
  });

  it("supports a custom expected status", async () => {
    const result = await performCheck(target("/status/204", { expectedStatus: 204 }), opts);
    expect(result.ok).toBe(true);
  });

  it("connection refused -> failure", async () => {
    const result = await performCheck(
      { url: "http://127.0.0.1:1", method: "GET", timeoutMs: 2000, expectedStatus: 200 },
      opts,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNREFUSED|fetch failed/);
  });

  it("SSRF guard blocks private targets when not explicitly allowed", async () => {
    const result = await performCheck(target("/ok"));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^Blocked:/);
  });
});
