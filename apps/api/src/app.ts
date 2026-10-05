import {
  EXAMPLE_STRATEGY_NOTE,
  EXAMPLE_VAULT_STRATEGIES,
  RISK_PROFILE_IDS,
  STABLE_ASSETS,
  blendStrategy,
  isRiskProfile,
  recommend,
  type DataMode,
  type RankedOption,
  type StableAsset,
} from "@stablesave/core";
import { createDefaultProviders, createOpportunityService, type OpportunityService } from "@stablesave/protocol-adapters";
import { METHODOLOGY_VERSION, SAFETY_DISCLAIMER } from "@stablesave/risk-engine";
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface AppOptions {
  mode: DataMode;
  service?: OpportunityService;
}

/**
 * Read-only JSON API. Every response that contains market data includes its
 * `mode`, so clients can label demo data.
 */
export function createApp({ mode, service }: AppOptions) {
  const opportunities = service ?? createOpportunityService({ providers: createDefaultProviders(mode) });
  const app = new Hono();

  app.use("*", cors({ origin: "*", allowMethods: ["GET"] }));

  app.get("/health", (c) => c.json({ ok: true, mode, methodologyVersion: METHODOLOGY_VERSION }));

  /** Full rated snapshot. Optional filters: `asset` (USDC | USDT), `network` (e.g. solana, ethereum). */
  app.get("/v1/opportunities", async (c) => {
    const snapshot = await opportunities.getSnapshot();
    const asset = c.req.query("asset")?.toUpperCase();
    const network = c.req.query("network")?.toLowerCase();
    c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    const byAsset = asset && (STABLE_ASSETS as readonly string[]).includes(asset);
    if (!byAsset && !network) return c.json(snapshot);
    return c.json({
      ...snapshot,
      opportunities: snapshot.opportunities.filter((o) => (!byAsset || o.asset === asset) && (!network || o.network === network)),
    });
  });

  app.get("/v1/opportunities/:id", async (c) => {
    const opportunity = await opportunities.getOpportunity(c.req.param("id"));
    if (!opportunity) return c.json({ error: "not_found" }, 404);
    return c.json({ opportunity, disclaimer: SAFETY_DISCLAIMER });
  });

  /** Recommendation for an amount + risk profile: amount × estimated yield − fees. */
  app.get("/v1/estimate", async (c) => {
    const amount = Number(c.req.query("amount") ?? "10000");
    const asset = (c.req.query("asset")?.toUpperCase() ?? "USDC") as StableAsset;
    const profile = c.req.query("risk") ?? "balanced";
    if (!Number.isFinite(amount) || amount < 0) return c.json({ error: "invalid_amount" }, 400);
    if (!(STABLE_ASSETS as readonly string[]).includes(asset)) return c.json({ error: "invalid_asset" }, 400);
    if (!isRiskProfile(profile)) return c.json({ error: "invalid_risk", allowed: RISK_PROFILE_IDS }, 400);

    const snapshot = await opportunities.getSnapshot();
    const rec = recommend({ amount, asset, profile, opportunities: snapshot.opportunities });
    const vault = asset === "USDC" ? blendStrategy(EXAMPLE_VAULT_STRATEGIES[profile], snapshot.opportunities, amount) : null;
    return c.json({
      mode: snapshot.mode,
      estimated: true,
      amount,
      asset,
      profile,
      best: rec.best && summarize(rec.best),
      /** Only when nothing meets the risk setting: the safest option that otherwise works. */
      closest: rec.closest && summarize(rec.closest),
      ranked: rec.ranked.map((r) => ({
        opportunityId: r.opportunity.id,
        network: r.opportunity.network,
        eligible: r.eligible,
        ineligibleReason: r.ineligibleReason ?? null,
        apy: r.opportunity.yield.totalApy,
        grade: r.opportunity.safety.display,
        netEarnings: r.estimate.netEarnings,
      })),
      vault: vault && {
        apy: vault.apy,
        grade: vault.safety.display,
        netEarnings: vault.estimate.netEarnings,
        allocations: vault.strategy.allocations,
        note: EXAMPLE_STRATEGY_NOTE,
      },
    });
  });

  function summarize(r: RankedOption) {
    return {
      opportunityId: r.opportunity.id,
      protocol: r.opportunity.protocolName,
      network: r.opportunity.network,
      apy: r.opportunity.yield.totalApy,
      grade: r.opportunity.safety.display,
      estimate: r.estimate,
    };
  }

  /** Example vault strategies (labelled as examples). */
  app.get("/v1/strategies", async (c) => {
    const snapshot = await opportunities.getSnapshot();
    return c.json({
      mode: snapshot.mode,
      note: EXAMPLE_STRATEGY_NOTE,
      strategies: RISK_PROFILE_IDS.map((profile) => {
        const strategy = EXAMPLE_VAULT_STRATEGIES[profile];
        const blend = blendStrategy(strategy, snapshot.opportunities, 10_000);
        return {
          ...strategy,
          estimate: blend && { apy: blend.apy, grade: blend.safety.display, netEarningsOn10k: blend.estimate.netEarnings },
        };
      }),
    });
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
