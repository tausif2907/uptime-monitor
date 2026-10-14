export interface CheckCounts {
  totalChecks: number;
  okChecks: number;
}

/** Uptime % = okChecks / totalChecks * 100, or null when there is no data yet. */
export function uptimePercent({ totalChecks, okChecks }: CheckCounts): number | null {
  if (totalChecks <= 0) return null;
  return (Math.min(okChecks, totalChecks) / totalChecks) * 100;
}

/** Sum several windows (e.g. DailyStat rows + today's raw checks) into one count. */
export function sumCounts(parts: CheckCounts[]): CheckCounts {
  return parts.reduce(
    (acc, p) => ({
      totalChecks: acc.totalChecks + p.totalChecks,
      okChecks: acc.okChecks + p.okChecks,
    }),
    { totalChecks: 0, okChecks: 0 },
  );
}

/** "99.95%" — never rounds a non-perfect value up to 100%. */
export function formatUptime(percent: number | null): string {
  if (percent === null) return "—";
  if (percent >= 100) return "100%";
  const floored = Math.floor(percent * 100) / 100;
  return `${floored.toFixed(2)}%`;
}

export type DayLevel = "none" | "up" | "degraded" | "down";

/** Colour bucket for one day on the 90-day status bars. */
export function dayLevel(percent: number | null): DayLevel {
  if (percent === null) return "none";
  if (percent >= 99.9) return "up";
  if (percent >= 98) return "degraded";
  return "down";
}

/** Nearest-rank percentile (p in 0..100). Returns null for an empty list. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? null;
}
