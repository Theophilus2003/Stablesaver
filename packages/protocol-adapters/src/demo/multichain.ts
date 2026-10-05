import { getNetwork, networkIdFromName, type Opportunity, type StableAsset, type StrategyType } from "@stablesave/core";
import type { OpportunityProvider } from "../types";
import { DEMO_PROVIDER } from "./source";
import { apySeries } from "./series";

/**
 * DEMO DATA for networks other than Solana.
 *
 * Illustrative figures so demo mode shows the multi-network experience. They
 * are NOT measurements of the protocols named and are always labelled "Demo
 * data". Inputs we couldn't know (bug bounties, upgrade controls, incident
 * history, concentration) are left unknown, exactly as in live mode, rather
 * than invented for real protocols.
 */
interface Spec {
  protocolId: string;
  protocolName: string;
  officialUrl: string;
  chain: string;
  asset: StableAsset;
  marketName: string;
  strategyType: StrategyType;
  baseApy: number;
  rewardApy: number;
  apySd: number;
  tvlUsd: number;
  liquidityUsd: number;
  utilization: number | null;
  launchedAt: string;
  audits: number;
  oracles: string[];
  withdrawalDelayHours?: number;
}

const SPECS: Spec[] = [
  { protocolId: "aave-v3", protocolName: "Aave V3", officialUrl: "https://app.aave.com", chain: "Ethereum", asset: "USDT", marketName: "Core market", strategyType: "lending", baseApy: 0.037, rewardApy: 0, apySd: 0.004, tvlUsd: 4_800_000_000, liquidityUsd: 1_300_000_000, utilization: 0.73, launchedAt: "2023-01-27", audits: 12, oracles: ["Chainlink"] },
  { protocolId: "aave-v3", protocolName: "Aave V3", officialUrl: "https://app.aave.com", chain: "Ethereum", asset: "USDC", marketName: "Core market", strategyType: "lending", baseApy: 0.041, rewardApy: 0, apySd: 0.005, tvlUsd: 3_900_000_000, liquidityUsd: 900_000_000, utilization: 0.77, launchedAt: "2023-01-27", audits: 12, oracles: ["Chainlink"] },
  { protocolId: "aave-v3", protocolName: "Aave V3", officialUrl: "https://app.aave.com", chain: "Arbitrum", asset: "USDC", marketName: "Main market", strategyType: "lending", baseApy: 0.046, rewardApy: 0, apySd: 0.007, tvlUsd: 210_000_000, liquidityUsd: 48_000_000, utilization: 0.77, launchedAt: "2022-03-16", audits: 12, oracles: ["Chainlink"] },
  { protocolId: "aave-v3", protocolName: "Aave V3", officialUrl: "https://app.aave.com", chain: "Avalanche", asset: "USDT", marketName: "Main market", strategyType: "lending", baseApy: 0.031, rewardApy: 0, apySd: 0.006, tvlUsd: 64_000_000, liquidityUsd: 21_000_000, utilization: 0.67, launchedAt: "2022-03-16", audits: 12, oracles: ["Chainlink"] },
  { protocolId: "morpho-blue", protocolName: "Morpho", officialUrl: "https://app.morpho.org", chain: "Base", asset: "USDC", marketName: "Curated USDC vault", strategyType: "curated-vault", baseApy: 0.052, rewardApy: 0.008, apySd: 0.009, tvlUsd: 330_000_000, liquidityUsd: 80_000_000, utilization: null, launchedAt: "2024-01-02", audits: 9, oracles: ["Chainlink", "Redstone"] },
  { protocolId: "venus-core-pool", protocolName: "Venus", officialUrl: "https://app.venus.io", chain: "BSC", asset: "USDT", marketName: "Core pool", strategyType: "lending", baseApy: 0.044, rewardApy: 0.006, apySd: 0.011, tvlUsd: 700_000_000, liquidityUsd: 170_000_000, utilization: 0.76, launchedAt: "2020-11-23", audits: 6, oracles: ["Chainlink", "Binance Oracle"] },
  { protocolId: "fluid-lending", protocolName: "Fluid", officialUrl: "https://fluid.io", chain: "Plasma", asset: "USDT", marketName: "USDT0 lending", strategyType: "lending", baseApy: 0.042, rewardApy: 0.03, apySd: 0.018, tvlUsd: 190_000_000, liquidityUsd: 35_000_000, utilization: 0.82, launchedAt: "2025-09-25", audits: 4, oracles: ["Chainlink"] },
  { protocolId: "maple", protocolName: "Maple", officialUrl: "https://app.maple.finance", chain: "Ethereum", asset: "USDT", marketName: "Syrup USDT", strategyType: "yield", baseApy: 0.068, rewardApy: 0, apySd: 0.006, tvlUsd: 900_000_000, liquidityUsd: 60_000_000, utilization: null, launchedAt: "2024-10-01", audits: 5, oracles: [], withdrawalDelayHours: 48 },
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function demoMultichainOpportunities(now = new Date()): Opportunity[] {
  const at = now.toISOString();
  return SPECS.map((spec) => {
    const network = getNetwork(networkIdFromName(spec.chain), spec.chain);
    const id = `${spec.protocolId}-${network.id}-${slug(spec.marketName)}-${spec.asset.toLowerCase()}`;
    const totalApy = Math.round((spec.baseApy + spec.rewardApy) * 1e6) / 1e6;
    const kind = spec.strategyType === "lending" ? "Lending" : spec.strategyType === "curated-vault" ? "Vault" : "Yield";
    return {
      id,
      protocolId: spec.protocolId,
      protocolName: spec.protocolName,
      protocolLogo: null,
      productName: `${spec.asset} ${kind}`,
      marketName: spec.marketName,
      strategyType: spec.strategyType,
      description:
        spec.strategyType === "lending"
          ? `Your ${spec.asset} is lent to borrowers through ${spec.protocolName} on ${network.name}. Borrowers post more collateral than they borrow and pay interest, which is passed on to you.`
          : spec.strategyType === "curated-vault"
            ? `Your ${spec.asset} goes into a ${spec.protocolName} vault on ${network.name}, which a curator spreads across lending markets.`
            : `Your ${spec.asset} is deposited with ${spec.protocolName} on ${network.name}, which lends it to vetted institutions. Withdrawals can take a few days.`,
      network: network.id,
      networkName: network.name,
      asset: spec.asset,
      yield: { baseApy: spec.baseApy, rewardApy: spec.rewardApy, totalApy },
      tvlUsd: spec.tvlUsd,
      liquidityUsd: spec.liquidityUsd,
      depositors: null,
      fees: {
        depositFeeBps: 0,
        withdrawalFeeBps: 0,
        performanceFeeBps: 0,
        estimatedNetworkFeeUsd: network.estimatedNetworkFeeUsd,
        refundableRentUsd: 0,
      },
      risk: {
        launchedAt: spec.launchedAt,
        audits: spec.audits,
        bugBountyUsd: null,
        upgradeAuthority: "unknown",
        openSource: null,
        strategyComplexity: spec.strategyType === "lending" ? "simple" : "moderate",
        usesLeverage: false,
        incidents: [],
        incidentsReviewed: false,
        apyHistory30d: apySeries(id, totalApy, spec.apySd),
        oracleSetup: spec.oracles.length >= 2 ? "redundant" : spec.oracles.length === 1 ? "single" : "unknown",
        oracles: spec.oracles,
        utilization: spec.utilization,
        withdrawalDelayHours: spec.withdrawalDelayHours ?? 0,
        topDepositorsShare: null,
        collateralConcentration: null,
      },
      officialUrl: spec.officialUrl,
      officialDomain: new URL(spec.officialUrl).hostname,
      updatedAt: at,
      provenance: {
        mode: "demo",
        provider: DEMO_PROVIDER,
        fetchedAt: at,
        note: `Illustrative numbers for development. Not a real measurement of ${spec.protocolName}.`,
      },
    };
  });
}

/** Demo options on networks other than Solana. Always reports `mode: "demo"`. */
export class DemoMultichainProvider implements OpportunityProvider {
  readonly id = "demo-multichain";
  readonly name = "Other networks";
  readonly mode = "demo" as const;

  async listOpportunities(): Promise<Opportunity[]> {
    return demoMultichainOpportunities();
  }
}
