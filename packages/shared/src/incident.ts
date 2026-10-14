import { FAILURE_THRESHOLD } from "./constants";

export type MonitorStatus = "PENDING" | "UP" | "DOWN";

export interface MonitorState {
  status: MonitorStatus;
  consecutiveFailures: number;
}

export interface CheckOutcome {
  ok: boolean;
}

export type IncidentAction = "OPEN_INCIDENT" | "RESOLVE_INCIDENT" | null;

export interface NextState extends MonitorState {
  action: IncidentAction;
}

/**
 * The whole incident state machine in one pure function.
 *
 * - A success resets the failure counter; if the monitor was DOWN, the open incident resolves.
 * - A failure increments the counter; on reaching FAILURE_THRESHOLD the monitor goes DOWN and
 *   an incident opens. Further failures while DOWN do nothing (the incident is already open).
 * - Below the threshold the previous status is kept, so a single blip never flips UP -> DOWN.
 */
export function nextState(
  monitor: MonitorState,
  result: CheckOutcome,
  threshold: number = FAILURE_THRESHOLD,
): NextState {
  if (result.ok) {
    return {
      status: "UP",
      consecutiveFailures: 0,
      action: monitor.status === "DOWN" ? "RESOLVE_INCIDENT" : null,
    };
  }

  const consecutiveFailures = monitor.consecutiveFailures + 1;

  if (monitor.status === "DOWN") {
    return { status: "DOWN", consecutiveFailures, action: null };
  }

  if (consecutiveFailures >= threshold) {
    return { status: "DOWN", consecutiveFailures, action: "OPEN_INCIDENT" };
  }

  return { status: monitor.status, consecutiveFailures, action: null };
}
