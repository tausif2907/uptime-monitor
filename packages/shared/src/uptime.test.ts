import { describe, expect, it } from "vitest";
import { dayLevel, formatUptime, percentile, sumCounts, uptimePercent } from "./uptime";

describe("uptimePercent", () => {
  it("is null with no checks", () => {
    expect(uptimePercent({ totalChecks: 0, okChecks: 0 })).toBeNull();
  });

  it("computes ok / total * 100", () => {
    expect(uptimePercent({ totalChecks: 1440, okChecks: 1440 })).toBe(100);
    expect(uptimePercent({ totalChecks: 200, okChecks: 199 })).toBe(99.5);
  });

  it("never exceeds 100", () => {
    expect(uptimePercent({ totalChecks: 10, okChecks: 12 })).toBe(100);
  });
});

describe("sumCounts", () => {
  it("adds windows together", () => {
    expect(
      sumCounts([
        { totalChecks: 100, okChecks: 99 },
        { totalChecks: 50, okChecks: 50 },
      ]),
    ).toEqual({ totalChecks: 150, okChecks: 149 });
  });
});

describe("formatUptime", () => {
  it("does not round 99.999 up to 100", () => {
    expect(formatUptime(99.999)).toBe("99.99%");
    expect(formatUptime(100)).toBe("100%");
    expect(formatUptime(null)).toBe("—");
  });
});

describe("dayLevel", () => {
  it("buckets days for the status bars", () => {
    expect(dayLevel(null)).toBe("none");
    expect(dayLevel(100)).toBe("up");
    expect(dayLevel(99)).toBe("degraded");
    expect(dayLevel(90)).toBe("down");
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBeNull();
  });
});
