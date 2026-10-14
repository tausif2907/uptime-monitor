import { cx } from "./ui";

type Status = "UP" | "DOWN" | "PENDING";

const styles: Record<Status | "PAUSED", { dot: string; text: string; label: string }> = {
  UP: { dot: "bg-up", text: "text-green-700 dark:text-green-400", label: "Up" },
  DOWN: { dot: "bg-down", text: "text-red-700 dark:text-red-400", label: "Down" },
  PENDING: { dot: "bg-pending", text: "text-zinc-500", label: "Pending" },
  PAUSED: { dot: "bg-degraded", text: "text-amber-700 dark:text-amber-400", label: "Paused" },
};

export function StatusBadge({ status, paused }: { status: Status; paused?: boolean }) {
  const s = styles[paused ? "PAUSED" : status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", s.text)}>
      <span className={cx("h-2.5 w-2.5 rounded-full", s.dot, status === "DOWN" && !paused && "animate-pulse")} />
      {s.label}
    </span>
  );
}
