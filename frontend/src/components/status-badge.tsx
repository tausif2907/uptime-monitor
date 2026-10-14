import { cx } from "./ui";

type Status = "UP" | "DOWN" | "PENDING";

const styles: Record<Status | "PAUSED", { dot: string; pill: string; label: string }> = {
  UP: { dot: "bg-up", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400", label: "Up" },
  DOWN: { dot: "bg-down", pill: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400", label: "Down" },
  PENDING: { dot: "bg-pending", pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", label: "Pending" },
  PAUSED: { dot: "bg-degraded", pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400", label: "Paused" },
};

export function StatusBadge({ status, paused }: { status: Status; paused?: boolean }) {
  const key = paused ? "PAUSED" : status;
  const s = styles[key];
  const live = key === "UP" || key === "DOWN";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.pill)}>
      <span className="relative flex h-2 w-2">
        {live && <span className={cx("absolute inline-flex h-full w-full animate-ping-slow rounded-full opacity-60", s.dot)} />}
        <span className={cx("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
      </span>
      {s.label}
    </span>
  );
}
