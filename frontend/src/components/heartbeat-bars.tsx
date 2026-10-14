import type { Beat } from "@/lib/stats";
import { cx } from "./ui";

const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });

/** Last N checks as little bars (green = ok, red = failed). Empty slots on the left. */
export function HeartbeatBars({ beats, slots = 30 }: { beats: Beat[]; slots?: number }) {
  const padded: (Beat | null)[] = [...Array(Math.max(0, slots - beats.length)).fill(null), ...beats.slice(-slots)];
  return (
    <div className="flex h-7 items-end gap-[2px]" role="img" aria-label={`Last ${beats.length} checks`}>
      {padded.map((b, i) => (
        <span
          key={i}
          title={b ? `${fmt.format(new Date(b.checkedAt))} · ${b.ok ? "OK" : "Failed"}${b.responseTimeMs != null ? ` · ${b.responseTimeMs} ms` : ""}` : "No data yet"}
          className={cx(
            "h-full w-1.5 rounded-full transition hover:scale-y-110",
            !b && "bg-zinc-200 dark:bg-zinc-800",
            b?.ok && "bg-up/85 hover:bg-up",
            b && !b.ok && "bg-down",
          )}
        />
      ))}
    </div>
  );
}
