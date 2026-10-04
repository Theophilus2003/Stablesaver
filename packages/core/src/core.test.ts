import { describe, expect, it } from "vitest";
import {
  EXAMPLE_VAULT_STRATEGIES,
  allStrategies,
  estimateEarnings,
  formatCompactUsd,
  formatCountdown,
  formatPercent,
  gradeFromScore,
  maxScoreFor,
  meetsGrade,
  validateStrategy,
} from "./index";

describe("estimateEarnings", () => {
  it("is amount × apy − fees", () => {
    const e = estimateEarnings(10_000, 0.0515, {
      depositFeeBps: 0,
      withdrawalFeeBps: 0,
      performanceFeeBps: 1000,
      estimatedNetworkFeeUsd: 0.02,
      refundableRentUsd: 3,
    });
    expect(e.grossYield).toBeCloseTo(515, 6);
    expect(e.totalFees).toBeCloseTo(0.02, 6);
    expect(e.netEarnings).toBeCloseTo(514.98, 6);
  });

  it("applies deposit and withdrawal fees", () => {
    const e = estimateEarnings(1_000, 0.1, {
      depositFeeBps: 100,
      withdrawalFeeBps: 50,
      performanceFeeBps: 0,
      estimatedNetworkFeeUsd: 1,
      refundableRentUsd: 0,
    });
    // invested 990, yield 99, withdrawal fee 0.5% of 1089
    expect(e.depositFee).toBeCloseTo(10);
    expect(e.grossYield).toBeCloseTo(99);
    expect(e.withdrawalFee).toBeCloseTo(5.445);
    expect(e.netEarnings).toBeCloseTo(99 - 10 - 5.445 - 1);
  });

  it("handles zero and invalid input", () => {
    expect(estimateEarnings(0, 0.05).netEarnings).toBe(0);
    expect(estimateEarnings(Number.NaN, 0.05).netEarnings).toBe(0);
    expect(estimateEarnings(-5, 0.05).netEarnings).toBe(0);
  });
});

describe("grades", () => {
  it("maps scores to bands without an A+", () => {
    expect(gradeFromScore(100).display).toBe("A");
    expect(gradeFromScore(82).display).toBe("A-");
    expect(gradeFromScore(77).display).toBe("B+");
    expect(gradeFromScore(51).display).toBe("C-");
    expect(gradeFromScore(12).display).toBe("D");
  });

  it("computes cap ceilings", () => {
    expect(maxScoreFor("C", "")).toBe(59);
    expect(gradeFromScore(maxScoreFor("C", "")).display).toBe("C");
    expect(maxScoreFor("A", "")).toBe(100);
  });

  it("compares grades", () => {
    expect(meetsGrade("A", "B")).toBe(true);
    expect(meetsGrade("C", "B")).toBe(false);
  });
});

describe("strategies", () => {
  it("example strategies are valid", () => {
    for (const s of allStrategies()) expect(validateStrategy(s)).toEqual([]);
  });

  it("rejects bad weights and duplicates", () => {
    const bad = {
      allocations: [
        { protocolId: "kamino" as const, opportunityId: "a", weightBps: 6000 },
        { protocolId: "kamino" as const, opportunityId: "b", weightBps: 3000 },
      ],
    };
    const errors = validateStrategy(bad);
    expect(errors.some((e) => e.includes("more than once"))).toBe(true);
    expect(errors.some((e) => e.includes("add up to 100%"))).toBe(true);
  });

  it("labels examples as examples", () => {
    expect(EXAMPLE_VAULT_STRATEGIES.balanced.source).toBe("example");
  });
});

describe("format", () => {
  it("formats numbers", () => {
    expect(formatPercent(0.0515)).toBe("5.15%");
    expect(formatCompactUsd(412_500_000)).toBe("$412.5M");
    expect(formatCompactUsd(1_200_000_000)).toBe("$1.2B");
    expect(formatCountdown(27 * 60 + 42)).toBe("27:42");
    expect(formatCountdown(3789)).toBe("1:03:09");
  });
});
