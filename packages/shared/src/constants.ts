/** Consecutive failed checks before an incident opens (one failure is not an outage). */
export const FAILURE_THRESHOLD = 2;

/** Raw CheckResult rows older than this are deleted after being rolled into DailyStat. */
export const RAW_RETENTION_DAYS = 30;

/** Days shown as bars on the public status page. */
export const STATUS_PAGE_DAYS = 90;

/** Allowed check intervals (seconds): every 1, 2, 3, 5 minutes. */
export const INTERVAL_OPTIONS = [60, 120, 180, 300] as const;

/** Abuse guard: the demo account is public, and every monitor is real outbound traffic. */
export const MAX_MONITORS_PER_PROJECT = 20;
export const MAX_PROJECTS_PER_USER = 10;

export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_TIMEOUT_MS = 30_000;
export const MAX_REDIRECTS = 5;

/** BullMQ queue names, shared by the frontend (producer) and backend (consumer). */
export const QUEUES = {
  checks: "checks",
  maintenance: "maintenance",
} as const;

export const JOBS = {
  check: "check",
  reconcile: "reconcile",
  rollup: "rollup",
} as const;
