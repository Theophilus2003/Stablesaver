import { blendStrategy, EXAMPLE_VAULT_STRATEGIES, recommend } from "@stablesave/core";
import { describe, expect, it } from "vitest";
import {
  createDefaultProviders,
  createOpportunityService,
  DirectDepositUnavailableError,
  KaminoAdapter,
  DemoMarketSource,
} from "./index";

describe("opportunity service (demo)", () => {
  const service = createOpportunityService({ providers: createDefaultProviders("demo") });

  it("labels every opportunity as demo data", async () => {
    const snapshot = await service.getSnapshot();
    expect(snapshot.mode).toBe("demo");
    expect(snapshot.opportunities.length).toBeGreaterThanOrEqual(12);
    for (const o of snapshot.opportunities) {
      expect(o.provenance.mode).toBe("demo");
      expect(["A", "B", "C", "D"]).toContain(o.safety.grade);
    }
    expect(snapshot.summary.networkCount).toBeGreaterThanOrEqual(5);
    expect(new Set(snapshot.opportunities.filter((o) => o.network === "solana").map((o) => o.protocolId))).toEqual(
      new Set(["kamino", "marginfi", "drift", "save"]),
    );
  });

  it("ships 90 days of labelled demo rate history ending with the last 30 days used for grading", async () => {
    const snapshot = await service.getSnapshot();
    for (const o of snapshot.opportunities) {
      const history = o.rateHistory ?? [];
      expect(history).toHaveLength(90);
      expect(history.slice(-30).map((p) => p.apy)).toEqual(o.risk.apyHistory30d);
      expect(history.at(-1)!.apy).toBeCloseTo(o.yield.totalApy);
      expect(o.yield.avgApy30d).toBeGreaterThan(0);
      expect(typeof o.yield.apyChange7d).toBe("number");
    }
  });

  it("produces a spread of grades", async () => {
    const { opportunities } = await service.getSnapshot();
    const grades = new Set(opportunities.map((o) => o.safety.grade));
    expect(grades.has("A")).toBe(true);
    expect(grades.size).toBeGreaterThanOrEqual(3);
  });

  it("recommends differently per risk profile", async () => {
    const { opportunities } = await service.getSnapshot();
    const safe = recommend({ amount: 10_000, asset: "USDC", profile: "safe", opportunities });
    const bigger = recommend({ amount: 10_000, asset: "USDC", profile: "bigger", opportunities });
    expect(safe.best?.opportunity.safety.grade).toBe("A");
    expect(bigger.best!.opportunity.yield.totalApy).toBeGreaterThanOrEqual(safe.best!.opportunity.yield.totalApy);
  });

  it("blends example strategies against market data", async () => {
    const { opportunities } = await service.getSnapshot();
    for (const strategy of Object.values(EXAMPLE_VAULT_STRATEGIES)) {
      const blend = blendStrategy(strategy, opportunities, 10_000);
      expect(blend).not.toBeNull();
      expect(blend!.missing).toEqual([]);
      expect(blend!.estimate.netEarnings).toBeGreaterThan(0);
    }
  });
});

describe("adapter interface", () => {
  it("answers per-market questions and refuses to fake transactions", async () => {
    const kamino = new KaminoAdapter(new DemoMarketSource("kamino"));
    expect(await kamino.getCurrentYield("main-usdc")).toBeGreaterThan(0);
    expect(await kamino.getLiquidity("main-usdc")).toBeGreaterThan(0);
    expect((await kamino.getRiskData("main-usdc")).audits).toBeGreaterThan(0);
    await expect(
      kamino.getDepositTransaction({ marketId: "main-usdc", owner: "11111111111111111111111111111111", amount: 1n }),
    ).rejects.toBeInstanceOf(DirectDepositUnavailableError);
  });
});
