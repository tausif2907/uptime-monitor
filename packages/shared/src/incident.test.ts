import { describe, expect, it } from "vitest";
import { nextState, type MonitorState } from "./incident";

const ok = { ok: true };
const fail = { ok: false };

describe("nextState", () => {
  it("PENDING + success -> UP, no incident", () => {
    expect(nextState({ status: "PENDING", consecutiveFailures: 0 }, ok)).toEqual({
      status: "UP",
      consecutiveFailures: 0,
      action: null,
    });
  });

  it("UP + one failure stays UP (a single blip is not an outage)", () => {
    expect(nextState({ status: "UP", consecutiveFailures: 0 }, fail)).toEqual({
      status: "UP",
      consecutiveFailures: 1,
      action: null,
    });
  });

  it("UP + second consecutive failure -> DOWN and opens an incident", () => {
    expect(nextState({ status: "UP", consecutiveFailures: 1 }, fail)).toEqual({
      status: "DOWN",
      consecutiveFailures: 2,
      action: "OPEN_INCIDENT",
    });
  });

  it("PENDING + two failures -> DOWN and opens an incident", () => {
    const first = nextState({ status: "PENDING", consecutiveFailures: 0 }, fail);
    expect(first).toEqual({ status: "PENDING", consecutiveFailures: 1, action: null });
    expect(nextState(first, fail)).toEqual({
      status: "DOWN",
      consecutiveFailures: 2,
      action: "OPEN_INCIDENT",
    });
  });

  it("DOWN + more failures stays DOWN without opening a second incident", () => {
    expect(nextState({ status: "DOWN", consecutiveFailures: 2 }, fail)).toEqual({
      status: "DOWN",
      consecutiveFailures: 3,
      action: null,
    });
  });

  it("DOWN + success -> UP and resolves the incident", () => {
    expect(nextState({ status: "DOWN", consecutiveFailures: 5 }, ok)).toEqual({
      status: "UP",
      consecutiveFailures: 0,
      action: "RESOLVE_INCIDENT",
    });
  });

  it("UP + failure then success resets the counter (flapping never alerts)", () => {
    const blip = nextState({ status: "UP", consecutiveFailures: 0 }, fail);
    const recovered = nextState(blip, ok);
    expect(recovered).toEqual({ status: "UP", consecutiveFailures: 0, action: null });
    expect(nextState(recovered, fail).action).toBeNull();
  });

  it("respects a custom threshold", () => {
    let state: MonitorState = { status: "UP", consecutiveFailures: 0 };
    for (let i = 0; i < 2; i++) {
      const next = nextState(state, fail, 3);
      expect(next.action).toBeNull();
      state = next;
    }
    expect(nextState(state, fail, 3).action).toBe("OPEN_INCIDENT");
  });
});
