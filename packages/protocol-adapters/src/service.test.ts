import { blendStrategy, EXAMPLE_VAULT_STRATEGIES, recommend } from "@stablesave/core";
import { describe, expect, it } from "vitest";
import {
  createDefaultAdapters,
  createOpportunityService,
  DirectDepositUnavailableError,
  KaminoAdapter,
  DemoMarketSource,
} from "./index";

describe("opportunity service (demo)", () => {
  const service = createOpportunityService({ adapters: createDefaultAdapters("demo") });

  it("labels every opportunity as demo data", async () => {
    const snapshot = await service.getSnapshot();
    expect(snapshot.mode).toBe("demo");
    expect(snapshot.opportunities.length).toBeGreaterThanOrEqual(12);
    for (const o of snapshot.opportunities) {
      expect(o.provenance.mode).toBe("demo");
      expect(o.network).toBe("solana");
      expect(["A", "B", "C", "D"]).toContain(o.safety.grade);
    }
    expect(snapshot.summary.protocolCount).toBe(4);
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

describe("live mode", () => {
  it("reports adapters as unavailable instead of inventing numbers", async () => {
    const service = createOpportunityService({ adapters: createDefaultAdapters("live") });
    const snapshot = await service.getSnapshot();
    expect(snapshot.opportunities).toEqual([]);
    expect(snapshot.adapters.every((a) => a.status === "unavailable")).toBe(true);
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
