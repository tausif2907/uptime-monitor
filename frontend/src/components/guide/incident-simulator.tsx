"use client";

import { nextState, type MonitorState } from "@uptime/shared";
import { Mail, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button, Card, cx } from "@/components/ui";

interface LogEntry {
  n: number;
  ok: boolean;
  status: MonitorState["status"];
  failures: number;
  alert: "down" | "up" | null;
}

/**
 * Interactive tutorial: drives the SAME nextState() function the real worker uses,
 * so what users see here is exactly how alerts behave in production.
 */
export function IncidentSimulator() {
  const [state, setState] = useState<MonitorState>({ status: "PENDING", consecutiveFailures: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);

  const run = (ok: boolean) => {
    const next = nextState(state, { ok });
    const alert: LogEntry["alert"] = next.action === "OPEN_INCIDENT" ? "down" : next.action === "RESOLVE_INCIDENT" ? "up" : null;
    setState({ status: next.status, consecutiveFailures: next.consecutiveFailures });
    setLog((l) => [{ n: l.length + 1, ok, status: next.status, failures: next.consecutiveFailures, alert }, ...l].slice(0, 8));
  };

  const reset = () => {
    setState({ status: "PENDING", consecutiveFailures: 0 });
    setLog([]);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">example.com</span>
          <StatusBadge status={state.status} />
          <span className="text-xs text-zinc-500">
            {state.consecutiveFailures} failure{state.consecutiveFailures === 1 ? "" : "s"} in a row
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => run(true)} className="py-2">
            <ThumbsUp className="h-4 w-4 text-emerald-500" /> Check succeeds
          </Button>
          <Button type="button" variant="secondary" onClick={() => run(false)} className="py-2">
            <ThumbsDown className="h-4 w-4 text-red-500" /> Check fails
          </Button>
          <Button type="button" variant="ghost" onClick={reset} className="py-2" aria-label="Reset simulator">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-48 p-5">
        {log.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">
            Click the buttons to simulate checks. Try: <b>fail</b>, <b>succeed</b>, then <b>fail</b>, <b>fail</b>.
          </p>
        ) : (
          <ol className="space-y-2">
            {log.map((e) => (
              <li key={e.n} className="flex flex-wrap items-center gap-3 text-sm animate-slide-up">
                <span className="w-16 text-xs text-zinc-400">Check #{e.n}</span>
                <span className={cx("w-16 font-medium", e.ok ? "text-emerald-600" : "text-red-600")}>{e.ok ? "OK" : "Failed"}</span>
                <span className="text-zinc-500">→</span>
                <StatusBadge status={e.status} />
                {e.alert && (
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                      e.alert === "down" ? "bg-red-600 text-white" : "bg-emerald-600 text-white",
                    )}
                  >
                    <Mail className="h-3 w-3" /> {e.alert === "down" ? "“Site is DOWN” email sent" : "“Back UP” email sent"}
                  </span>
                )}
                {!e.ok && !e.alert && e.status !== "DOWN" && (
                  <span className="text-xs text-zinc-500">One failure isn&apos;t an outage — no alert yet.</span>
                )}
                {!e.ok && !e.alert && e.status === "DOWN" && (
                  <span className="text-xs text-zinc-500">Still down — we don&apos;t spam you with repeats.</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
