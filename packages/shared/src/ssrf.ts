import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * SSRF guard: users submit URLs that our servers fetch, so every URL (and every redirect hop)
 * must resolve only to public addresses. Anything private, loopback, link-local (cloud metadata
 * at 169.254.169.254), multicast or reserved is rejected, as are non-HTTP(S) schemes.
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

// Separate lists: a single BlockList also matches IPv4 addresses against IPv6 rules (as
// ::ffff:a.b.c.d), so the IPv4-mapped rule below would otherwise block every IPv4 address.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();

// IPv4
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local / cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blockedV4.addSubnet(net, prefix, "ipv4");
}

// IPv6
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::ffff:0:0", 96], // IPv4-mapped (could smuggle 127.0.0.1)
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blockedV6.addSubnet(net, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedV4.check(address, "ipv4");
  if (family === 6) return blockedV6.check(address, "ipv6");
  return true; // not an IP at all — refuse rather than guess
}

export type LookupFn = (hostname: string) => Promise<string[]>;

const defaultLookup: LookupFn = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

export interface SafeUrlOptions {
  /** Skip the IP checks (tests / load tests against a local server). Scheme is still checked. */
  allowPrivate?: boolean;
  lookup?: LookupFn;
}

/** Parse and validate a URL; throws SsrfError if it is unsafe to fetch. */
export async function assertSafeUrl(raw: string | URL, options: SafeUrlOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Scheme "${url.protocol}" is not allowed`);
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with credentials are not allowed");
  }
  if (options.allowPrivate) return url;

  // URL keeps brackets around IPv6 literals: "[::1]".
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SsrfError("Localhost is not allowed");
  }

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = await (options.lookup ?? defaultLookup)(hostname);
    } catch {
      throw new SsrfError(`Could not resolve host "${hostname}"`);
    }
    if (addresses.length === 0) throw new SsrfError(`Could not resolve host "${hostname}"`);
  }

  // Every resolved address must be public, otherwise an attacker could mix in a private one.
  const bad = addresses.find(isBlockedAddress);
  if (bad) {
    throw new SsrfError(`"${hostname}" resolves to a private or reserved address (${bad})`);
  }
  return url;
}
