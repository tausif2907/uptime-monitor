import { describe, expect, it } from "vitest";
import { assertSafeUrl, isBlockedAddress, SsrfError } from "./ssrf";

const resolvesTo =
  (...addresses: string[]) =>
  async () =>
    addresses;

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "1.1.1.1", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("assertSafeUrl", () => {
  it("accepts a public https URL", async () => {
    const url = await assertSafeUrl("https://example.com/health", {
      lookup: resolvesTo("93.184.216.34"),
    });
    expect(url.hostname).toBe("example.com");
  });

  it.each(["file:///etc/passwd", "ftp://example.com", "gopher://example.com", "javascript:alert(1)"])(
    "rejects non-HTTP scheme %s",
    async (raw) => {
      await expect(assertSafeUrl(raw)).rejects.toBeInstanceOf(SsrfError);
    },
  );

  it.each([
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://api.localhost",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/", // decimal form of 127.0.0.1 — WHATWG URL normalises it
    "http://0x7f.1/",
  ])("rejects private literal %s", async (raw) => {
    await expect(assertSafeUrl(raw)).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects hostnames that resolve to a private address (DNS trick)", async () => {
    await expect(
      assertSafeUrl("http://internal.attacker.example", { lookup: resolvesTo("10.0.0.5") }),
    ).rejects.toThrow(/private or reserved/);
  });

  it("rejects when ANY resolved address is private", async () => {
    await expect(
      assertSafeUrl("http://mixed.example", { lookup: resolvesTo("93.184.216.34", "127.0.0.1") }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects unresolvable hosts", async () => {
    await expect(
      assertSafeUrl("http://nope.invalid", {
        lookup: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    ).rejects.toThrow(/Could not resolve/);
  });

  it("rejects credentials in the URL", async () => {
    await expect(assertSafeUrl("https://user:pass@example.com")).rejects.toBeInstanceOf(SsrfError);
  });

  it("allowPrivate skips IP checks but still enforces the scheme", async () => {
    await expect(assertSafeUrl("http://127.0.0.1:8080", { allowPrivate: true })).resolves.toBeInstanceOf(URL);
    await expect(assertSafeUrl("file:///etc/passwd", { allowPrivate: true })).rejects.toBeInstanceOf(
      SsrfError,
    );
  });
});
