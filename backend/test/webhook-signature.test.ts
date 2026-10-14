import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signatureHeaders } from "../src/notifier";

/** What a receiver does (same snippet as the in-app help page). */
function verify(rawBody: string, header: string, secret: string, nowSec: number) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("="))) as { t: string; v1: string };
  if (Math.abs(nowSec - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

describe("webhook signatures", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ event: "OPENED", monitor: { name: "Site" } });
  const now = Date.UTC(2026, 9, 15, 12, 0, 0);

  it("receivers can verify a genuine request", () => {
    const header = signatureHeaders(secret, body, now)["x-uptime-signature"];
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verify(body, header, secret, now / 1000)).toBe(true);
  });

  it("a tampered body fails verification", () => {
    const header = signatureHeaders(secret, body, now)["x-uptime-signature"];
    expect(verify(body.replace("OPENED", "RESOLVED"), header, secret, now / 1000)).toBe(false);
  });

  it("the wrong secret fails verification", () => {
    const header = signatureHeaders("attacker-guess", body, now)["x-uptime-signature"];
    expect(verify(body, header, secret, now / 1000)).toBe(false);
  });

  it("an old (replayed) request fails verification", () => {
    const header = signatureHeaders(secret, body, now)["x-uptime-signature"];
    expect(verify(body, header, secret, now / 1000 + 600)).toBe(false);
  });
});
