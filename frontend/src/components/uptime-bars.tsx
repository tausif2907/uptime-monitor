import { dayLevel, formatUptime, uptimePercent, type CheckCounts } from "@uptime/shared";
import { cx } from "./ui";

const levelClass = {
  none: "bg-zinc-200 dark:bg-zinc-800",
  up: "bg-up",
  degraded: "bg-degraded",
  down: "bg-down",
};

/** One bar per day (oldest left), coloured by that day's uptime. */
export function UptimeBars({
  days,
}: {
  days: { date: string; counts: CheckCounts | undefined }[];
}) {
  return (
    <div className="flex h-8 items-stretch gap-[2px]" role="img" aria-label="Daily uptime history">
      {days.map(({ date, counts }) => {
        const pct = counts ? uptimePercent(counts) : null;
        return (
          <div
            key={date}
            title={`${date} · ${pct === null ? "No data" : formatUptime(pct)}`}
            className={cx("min-w-[2px] flex-1 rounded-sm", levelClass[dayLevel(pct)])}
          />
        );
      })}
    </div>
  );
}
