import { MAX_REDIRECTS } from "@uptime/shared";
import { assertSafeUrl, SsrfError } from "@uptime/shared/server";

export interface CheckTarget {
  url: string;
  method: "GET" | "HEAD" | "POST";
  timeoutMs: number;
  expectedStatus: number;
}

export interface CheckOutput {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface CheckOptions {
  /** Skip the SSRF IP checks (tests and load tests only). */
  allowPrivate?: boolean;
}

const USER_AGENT = "UptimeMonitor/1.0 (+https://github.com/tausif2907/uptime-monitor)";

/**
 * Run one HTTP check.
 *
 * - The whole check (DNS, every redirect hop, headers) shares one AbortController deadline.
 * - Redirects are followed by hand so the SSRF guard re-validates every hop: a public URL
 *   must not be able to 302 us into 169.254.169.254.
 * - If the user expects a 3xx status, redirects are not followed so the 3xx itself is checked.
 */
export async function performCheck(
  target: CheckTarget,
  options: CheckOptions = {},
): Promise<CheckOutput> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const followRedirects = target.expectedStatus < 300 || target.expectedStatus >= 400;

  let url = target.url;
  let method: string = target.method;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertSafeUrl(url, { allowPrivate: options.allowPrivate });

      const res = await fetch(url, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      });

      const location = res.headers.get("location");
      if (followRedirects && res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        url = new URL(location, url).toString();
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
          method = "GET";
        }
        continue;
      }

      // We only need the status line; don't download the page.
      await res.body?.cancel();
      const responseTimeMs = elapsed();
      const ok = res.status === target.expectedStatus;
      return {
        ok,
        statusCode: res.status,
        responseTimeMs,
        error: ok ? null : `Expected status ${target.expectedStatus}, got ${res.status}`,
      };
    }

    return { ok: false, statusCode: null, responseTimeMs: elapsed(), error: "Too many redirects" };
  } catch (err) {
    return { ok: false, statusCode: null, responseTimeMs: null, error: describeError(err, target) };
  } finally {
    clearTimeout(timer);
  }
}

function describeError(err: unknown, target: CheckTarget): string {
  if (err instanceof SsrfError) return `Blocked: ${err.message}`;
  if (err instanceof Error && err.name === "AbortError") {
    return `Timed out after ${target.timeoutMs} ms`;
  }
  // undici wraps network failures as TypeError("fetch failed") with the real reason in `cause`.
  const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
  if (cause?.code) return `${cause.code}${cause.message ? `: ${cause.message}` : ""}`;
  return err instanceof Error ? err.message : String(err);
}
