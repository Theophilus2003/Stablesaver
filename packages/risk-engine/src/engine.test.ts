import type { Opportunity } from "@stablesave/core";
import { describe, expect, it } from "vitest";
import { calculateSafetyGrade, FACTORS } from "./index";

const NOW = new Date("2026-10-01T00:00:00Z");

function makeOpportunity(overrides: Partial<Opportunity["risk"]> = {}, top: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "test-usdc",
    protocolId: "kamino",
    protocolName: "Test",
    productName: "USDC Lending",
    marketName: "Main",
    strategyType: "lending",
    description: "",
    network: "solana",
    asset: "USDC",
    yield: { baseApy: 0.05, rewardApy: 0.002, totalApy: 0.052 },
    tvlUsd: 1_500_000_000,
    liquidityUsd: 300_000_000,
    depositors: 10_000,
    fees: { depositFeeBps: 0, withdrawalFeeBps: 0, performanceFeeBps: 0, estimatedNetworkFeeUsd: 0.02, refundableRentUsd: 0 },
    officialUrl: "https://example.com",
    officialDomain: "example.com",
    updatedAt: NOW.toISOString(),
    provenance: { mode: "demo", provider: "test", fetchedAt: NOW.toISOString() },
    ...top,
    risk: {
      launchedAt: "2021-01-01",
      audits: 4,
      bugBountyUsd: 1_000_000,
      upgradeAuthority: "timelocked-multisig",
      openSource: true,
      strategyComplexity: "simple",
      usesLeverage: false,
      incidents: [],
      apyHistory30d: Array.from({ length: 30 }, (_, i) => 0.052 + (i % 2 ? 0.001 : -0.001)),
      oracleSetup: "redundant",
      oracles: ["Pyth", "Switchboard"],
      utilization: 0.7,
      withdrawalDelayHours: 0,
      topDepositorsShare: 0.2,
      collateralConcentration: 0.3,
      ...overrides,
    },
  };
}

describe("calculateSafetyGrade", () => {
  it("weights sum to 100", () => {
    expect(FACTORS.reduce((s, f) => s + f.weight, 0)).toBe(100);
  });

  it("grades a mature, deep, simple market as A", () => {
    const result = calculateSafetyGrade(makeOpportunity(), { now: NOW });
    expect(result.grade).toBe("A");
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.factors).toHaveLength(9);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.caps).toEqual([]);
  });

  it("returns the documented shape", () => {
    const result = calculateSafetyGrade(makeOpportunity(), { now: NOW });
    expect(result).toMatchObject({ grade: expect.any(String), score: expect.any(Number), reasons: expect.any(Array) });
  });

  it("penalizes a young, complex, concentrated strategy", () => {
    const risky = calculateSafetyGrade(
      makeOpportunity(
        {
          launchedAt: "2026-02-01",
          audits: 1,
          bugBountyUsd: 0,
          upgradeAuthority: "multisig",
          strategyComplexity: "complex",
          usesLeverage: true,
          apyHistory30d: Array.from({ length: 30 }, (_, i) => 0.12 + Math.sin(i) * 0.04),
          oracleSetup: "single",
          utilization: 0.93,
          topDepositorsShare: 0.7,
          collateralConcentration: 0.9,
        },
        { tvlUsd: 8_000_000, liquidityUsd: 1_200_000 },
      ),
      { now: NOW },
    );
    expect(["C", "D"]).toContain(risky.grade);
  });

  it("caps unreimbursed recent losses at C", () => {
    const result = calculateSafetyGrade(
      makeOpportunity({
        incidents: [
          { date: "2025-11-01", severity: "minor", fundsLost: true, usersReimbursed: false, summary: "Test loss." },
        ],
      }),
      { now: NOW },
    );
    expect(result.score).toBeLessThanOrEqual(59);
    expect(result.caps.length).toBe(1);
    expect(result.reasons[0]).toContain("can't grade above C");
  });

  it("caps near-100% utilization at B-", () => {
    const result = calculateSafetyGrade(makeOpportunity({ utilization: 0.99 }), { now: NOW });
    expect(result.score).toBeLessThanOrEqual(69);
  });

  it("incidents fade with time", () => {
    const incident = { severity: "major" as const, fundsLost: false, usersReimbursed: false, summary: "x" };
    const recent = calculateSafetyGrade(makeOpportunity({ incidents: [{ ...incident, date: "2026-06-01" }] }), { now: NOW });
    const old = calculateSafetyGrade(makeOpportunity({ incidents: [{ ...incident, date: "2021-06-01" }] }), { now: NOW });
    expect(old.score).toBeGreaterThan(recent.score);
  });

  it("scores missing inputs conservatively and says so", () => {
    const known = calculateSafetyGrade(makeOpportunity(), { now: NOW });
    const unknown = calculateSafetyGrade(
      makeOpportunity({
        bugBountyUsd: null,
        upgradeAuthority: "unknown",
        openSource: null,
        oracleSetup: "unknown",
        oracles: [],
        topDepositorsShare: null,
        collateralConcentration: null,
        incidentsReviewed: false,
      }),
      { now: NOW },
    );
    expect(unknown.score).toBeLessThan(known.score);
    const unknownIds = unknown.factors.filter((f) => !f.known).map((f) => f.id);
    expect(unknownIds).toEqual(expect.arrayContaining(["incidents", "oracle", "concentration"]));
    expect(unknown.reasons.join(" ")).toMatch(/not reviewed|not verified|not available/);
  });

  it("caps options with many unverified factors at B", () => {
    const result = calculateSafetyGrade(
      makeOpportunity({
        launchedAt: null,
        audits: null,
        oracleSetup: "unknown",
        topDepositorsShare: null,
        collateralConcentration: null,
        incidentsReviewed: false,
      }),
      { now: NOW },
    );
    expect(result.score).toBeLessThanOrEqual(74);
    expect(result.caps).toContain("Too many risk inputs are unverified to grade above B.");
  });

  it("missing utilization doesn't crash and is mentioned", () => {
    const result = calculateSafetyGrade(makeOpportunity({ utilization: null }), { now: NOW });
    expect(result.factors.find((f) => f.id === "liquidity")!.detail).toMatch(/isn't reported/);
  });
});
