import type { FeeSchedule, ProtocolId, RiskData } from "@stablesave/core";
import type { ProtocolMarket } from "../types";
import { apySeries } from "./series";

/**
 * DEMO DATA.
 *
 * Illustrative figures for building and testing the product. They are shaped
 * like real Solana lending markets but are NOT measurements of Kamino,
 * MarginFi, Drift or Save, and must never be shown without a "Demo data"
 * label. Incident lists are intentionally empty: we don't attribute security
 * history to real protocols from made-up data.
 */

const SOLANA_FEES: FeeSchedule = {
  depositFeeBps: 0,
  withdrawalFeeBps: 0,
  performanceFeeBps: 0,
  // Two transactions (deposit + withdraw) with a modest priority fee.
  estimatedNetworkFeeUsd: 0.02,
  refundableRentUsd: 0.3,
};

interface MarketSpec extends Omit<ProtocolMarket, "yield" | "risk" | "fees" | "updatedAt"> {
  baseApy: number;
  rewardApy: number;
  apySd: number;
  fees?: Partial<FeeSchedule>;
  risk: Omit<RiskData, "apyHistory30d" | "incidents"> & Partial<Pick<RiskData, "incidents">>;
}

function market(protocol: ProtocolId, spec: MarketSpec): ProtocolMarket {
  const { baseApy, rewardApy, apySd, fees, risk, ...rest } = spec;
  const totalApy = round(baseApy + rewardApy);
  return {
    ...rest,
    yield: { baseApy, rewardApy, totalApy },
    fees: { ...SOLANA_FEES, ...fees },
    risk: {
      incidents: [],
      ...risk,
      apyHistory30d: apySeries(`${protocol}:${spec.marketId}`, totalApy, apySd),
    },
    updatedAt: new Date().toISOString(),
  };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

const LENDING_ORACLES = ["Pyth", "Switchboard"];

export function demoMarkets(protocol: ProtocolId): ProtocolMarket[] {
  switch (protocol) {
    case "kamino":
      return [
        market("kamino", {
          marketId: "main-usdc",
          productName: "USDC Lending",
          marketName: "Main Market",
          strategyType: "lending",
          asset: "USDC",
          description:
            "Your USDC is lent to borrowers in Kamino's Main Market. Borrowers post more collateral than they borrow and pay interest, which is passed on to you.",
          baseApy: 0.0492,
          rewardApy: 0.0023,
          apySd: 0.0025,
          tvlUsd: 1_420_000_000,
          liquidityUsd: 312_400_000,
          depositors: 48_210,
          fees: { refundableRentUsd: 2.4 },
          risk: {
            launchedAt: "2023-10-01",
            audits: 5,
            bugBountyUsd: 1_500_000,
            upgradeAuthority: "timelocked-multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: ["Pyth", "Switchboard", "Scope"],
            utilization: 0.78,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.22,
            collateralConcentration: 0.36,
          },
        }),
        market("kamino", {
          marketId: "jlp-usdc",
          productName: "USDC Lending",
          marketName: "JLP Market",
          strategyType: "lending",
          asset: "USDC",
          description:
            "Your USDC is lent to borrowers who mostly post a single collateral token (JLP). Higher rates, but more exposure to that one asset.",
          baseApy: 0.0791,
          rewardApy: 0.0042,
          apySd: 0.012,
          tvlUsd: 236_000_000,
          liquidityUsd: 31_800_000,
          depositors: 6_940,
          fees: { refundableRentUsd: 2.4 },
          risk: {
            launchedAt: "2024-05-01",
            audits: 5,
            bugBountyUsd: 1_500_000,
            upgradeAuthority: "timelocked-multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: ["Pyth", "Scope"],
            utilization: 0.87,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.41,
            collateralConcentration: 0.91,
          },
        }),
        market("kamino", {
          marketId: "earn-usdc",
          productName: "USDC Earn Vault",
          marketName: "Curated vault",
          strategyType: "curated-vault",
          asset: "USDC",
          description:
            "A managed vault that moves your USDC between several Kamino lending markets to chase the best rate. A curator decides the mix.",
          baseApy: 0.0571,
          rewardApy: 0.0018,
          apySd: 0.004,
          tvlUsd: 184_000_000,
          liquidityUsd: 64_000_000,
          depositors: 9_830,
          fees: { performanceFeeBps: 1_000, refundableRentUsd: 0.4 },
          risk: {
            launchedAt: "2025-03-15",
            audits: 2,
            bugBountyUsd: 1_500_000,
            upgradeAuthority: "timelocked-multisig",
            openSource: true,
            strategyComplexity: "moderate",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.74,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.35,
            collateralConcentration: 0.45,
          },
        }),
        market("kamino", {
          marketId: "main-usdt",
          productName: "USDT Lending",
          marketName: "Main Market",
          strategyType: "lending",
          asset: "USDT",
          description: "Your USDT is lent to over-collateralized borrowers in Kamino's Main Market.",
          baseApy: 0.0418,
          rewardApy: 0.0021,
          apySd: 0.003,
          tvlUsd: 318_000_000,
          liquidityUsd: 81_000_000,
          depositors: 14_600,
          fees: { refundableRentUsd: 2.4 },
          risk: {
            launchedAt: "2023-10-01",
            audits: 5,
            bugBountyUsd: 1_500_000,
            upgradeAuthority: "timelocked-multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: ["Pyth", "Switchboard", "Scope"],
            utilization: 0.75,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.29,
            collateralConcentration: 0.38,
          },
        }),
      ];
    case "marginfi":
      return [
        market("marginfi", {
          marketId: "global-usdc",
          productName: "USDC Lending",
          marketName: "Global Pool",
          strategyType: "lending",
          asset: "USDC",
          description:
            "Your USDC joins MarginFi's shared lending pool. Borrowers pay interest and must keep more collateral than they owe.",
          baseApy: 0.0451,
          rewardApy: 0.0045,
          apySd: 0.003,
          tvlUsd: 412_000_000,
          liquidityUsd: 118_000_000,
          depositors: 37_400,
          fees: { refundableRentUsd: 0.02 },
          risk: {
            launchedAt: "2023-01-15",
            audits: 3,
            bugBountyUsd: 500_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.71,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.27,
            collateralConcentration: 0.42,
          },
        }),
        market("marginfi", {
          marketId: "global-usdt",
          productName: "USDT Lending",
          marketName: "Global Pool",
          strategyType: "lending",
          asset: "USDT",
          description: "Your USDT joins MarginFi's shared lending pool and earns interest from borrowers.",
          baseApy: 0.0389,
          rewardApy: 0.0021,
          apySd: 0.003,
          tvlUsd: 96_000_000,
          liquidityUsd: 31_000_000,
          depositors: 8_100,
          fees: { refundableRentUsd: 0.02 },
          risk: {
            launchedAt: "2023-01-15",
            audits: 3,
            bugBountyUsd: 500_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.68,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.34,
            collateralConcentration: 0.4,
          },
        }),
      ];
    case "drift":
      return [
        market("drift", {
          marketId: "spot-usdc",
          productName: "USDC Spot Lending",
          marketName: "Spot Market",
          strategyType: "lending",
          asset: "USDC",
          description:
            "Your USDC is lent to traders on Drift's exchange. It can also back other traders' margin, which adds a layer of exchange risk.",
          baseApy: 0.0538,
          rewardApy: 0.0019,
          apySd: 0.006,
          tvlUsd: 486_000_000,
          liquidityUsd: 121_000_000,
          depositors: 29_800,
          risk: {
            launchedAt: "2022-12-01",
            audits: 3,
            bugBountyUsd: 500_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "moderate",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.79,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.3,
            collateralConcentration: 0.4,
          },
        }),
        market("drift", {
          marketId: "insurance-usdc",
          productName: "USDC Insurance Fund",
          marketName: "Insurance Fund Staking",
          strategyType: "insurance-fund",
          asset: "USDC",
          description:
            "Your USDC sits in Drift's insurance fund and earns a share of exchange fees. If traders leave bad debt, the fund pays for it — which can mean a loss for you.",
          baseApy: 0.106,
          rewardApy: 0,
          apySd: 0.025,
          tvlUsd: 58_000_000,
          liquidityUsd: 58_000_000,
          depositors: 4_120,
          risk: {
            launchedAt: "2022-12-01",
            audits: 3,
            bugBountyUsd: 500_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "complex",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0,
            withdrawalDelayHours: 24 * 13,
            topDepositorsShare: 0.46,
            collateralConcentration: 0,
          },
        }),
        market("drift", {
          marketId: "spot-usdt",
          productName: "USDT Spot Lending",
          marketName: "Spot Market",
          strategyType: "lending",
          asset: "USDT",
          description: "Your USDT is lent to traders on Drift's exchange.",
          baseApy: 0.0455,
          rewardApy: 0.0017,
          apySd: 0.006,
          tvlUsd: 64_000_000,
          liquidityUsd: 18_000_000,
          depositors: 5_400,
          risk: {
            launchedAt: "2023-06-01",
            audits: 3,
            bugBountyUsd: 500_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "moderate",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.81,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.38,
            collateralConcentration: 0.4,
          },
        }),
      ];
    case "save":
      return [
        market("save", {
          marketId: "main-usdc",
          productName: "USDC Lending",
          marketName: "Main Pool",
          strategyType: "lending",
          asset: "USDC",
          description:
            "Your USDC is lent through Save's main pool, one of the longest-running lending markets on Solana.",
          baseApy: 0.0441,
          rewardApy: 0.0016,
          apySd: 0.003,
          tvlUsd: 96_000_000,
          liquidityUsd: 33_000_000,
          depositors: 21_300,
          fees: { refundableRentUsd: 0.01 },
          risk: {
            launchedAt: "2021-08-01",
            audits: 4,
            bugBountyUsd: 1_000_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.66,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.31,
            collateralConcentration: 0.4,
          },
        }),
        market("save", {
          marketId: "main-usdt",
          productName: "USDT Lending",
          marketName: "Main Pool",
          strategyType: "lending",
          asset: "USDT",
          description: "Your USDT is lent through Save's main pool.",
          baseApy: 0.0384,
          rewardApy: 0.0014,
          apySd: 0.003,
          tvlUsd: 28_000_000,
          liquidityUsd: 11_000_000,
          depositors: 6_900,
          fees: { refundableRentUsd: 0.01 },
          risk: {
            launchedAt: "2021-08-01",
            audits: 4,
            bugBountyUsd: 1_000_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "redundant",
            oracles: LENDING_ORACLES,
            utilization: 0.61,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.39,
            collateralConcentration: 0.4,
          },
        }),
        market("save", {
          marketId: "turbo-sol-usdc",
          productName: "USDC Lending",
          marketName: "Turbo SOL Pool",
          strategyType: "lending",
          asset: "USDC",
          description:
            "An isolated pool where borrowers mostly post SOL. Higher rate, but a small pool with less liquidity and a single price feed.",
          baseApy: 0.0688,
          rewardApy: 0.0051,
          apySd: 0.011,
          tvlUsd: 9_600_000,
          liquidityUsd: 2_100_000,
          depositors: 1_870,
          fees: { refundableRentUsd: 0.01 },
          risk: {
            launchedAt: "2023-03-01",
            audits: 4,
            bugBountyUsd: 1_000_000,
            upgradeAuthority: "multisig",
            openSource: true,
            strategyComplexity: "simple",
            usesLeverage: false,
            oracleSetup: "single",
            oracles: ["Pyth"],
            utilization: 0.86,
            withdrawalDelayHours: 0,
            topDepositorsShare: 0.62,
            collateralConcentration: 0.85,
          },
        }),
      ];
  }
}
