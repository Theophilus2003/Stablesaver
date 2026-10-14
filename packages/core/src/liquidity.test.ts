import { describe, expect, it } from "vitest";
import { checkWithdrawal } from "./index";

const pool = (liquidityUsd: number, utilization: number | null, withdrawalDelayHours = 0) =>
  ({ liquidityUsd, risk: { utilization, withdrawalDelayHours } }) as Parameters<typeof checkWithdrawal>[0];

describe("checkWithdrawal", () => {
  it("says yes when plenty is free and the pool isn't busy", () => {
    const c = checkWithdrawal(pool(300_000_000, 0.7), 10_000);
    expect(c.status).toBe("ready");
    expect(c.answer).toBe("Yes, today");
    expect(c.availableUsd).toBe(300_000_000);
    expect(c.shareOfAvailable).toBeCloseTo(10_000 / 300_000_000);
  });

  it("is cautious when the pool is mostly lent out", () => {
    expect(checkWithdrawal(pool(50_000_000, 0.92), 1_000).status).toBe("likely");
    expect(checkWithdrawal(pool(50_000_000, 0.98), 1_000).status).toBe("tight");
  });

  it("looks at the amount against what's free", () => {
    expect(checkWithdrawal(pool(100_000, 0.5), 20_000).status).toBe("likely");
    const tight = checkWithdrawal(pool(100_000, 0.5), 80_000);
    expect(tight.status).toBe("tight");
    expect(tight.detail).toMatch(/large part/);
    expect(checkWithdrawal(pool(0, 0.5), 10).status).toBe("tight");
  });

  it("reports a waiting period before anything else", () => {
    const c = checkWithdrawal(pool(25_000_000, 0.1, 13 * 24), 1_000);
    expect(c.status).toBe("wait");
    expect(c.detail).toMatch(/13 days/);
  });

  it("doesn't guess when lending data is missing", () => {
    const c = checkWithdrawal(pool(9_600_000, null), 1_000);
    expect(c.status).toBe("unknown");
    expect(c.availableUsd).toBeNull();
  });

  it("treats a zero amount as no load", () => {
    expect(checkWithdrawal(pool(1_000_000, 0.5), 0).status).toBe("ready");
  });
});
