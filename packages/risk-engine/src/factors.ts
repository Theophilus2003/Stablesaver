import { formatCompactUsd, formatPercent, type Opportunity, type RiskFactorId } from "@stablesave/core";
import { clamp, interpolate, interpolateLog, standardDeviation } from "./interpolate";

export interface FactorResult {
  score: number;
  detail: string;
  /** False when the factor's main inputs are missing. Defaults to true. */
  known?: boolean;
}

/**
 * Score used when a factor's inputs are missing: below "neutral", so missing
 * data never makes an option look safer than verified data would.
 */
export const UNKNOWN_SCORE = 55;

export interface FactorDefinition {
  id: RiskFactorId;
  label: string;
  /** Weights across all factors sum to 100. */
  weight: number;
  evaluate(opportunity: Opportunity, now: Date): FactorResult;
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

function monthsBetween(fromIso: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(fromIso).getTime()) / MS_PER_MONTH);
}

function describeAge(months: number): string {
  if (months < 1) return "less than a month";
  if (months < 24) return `${Math.floor(months)} month${Math.floor(months) === 1 ? "" : "s"}`;
  return `${Math.floor(months / 12)}+ years`;
}

export const maturity: FactorDefinition = {
  id: "maturity",
  label: "Protocol maturity",
  weight: 14,
  evaluate(o, now) {
    if (!o.risk.launchedAt) {
      return { score: UNKNOWN_SCORE, known: false, detail: "Launch date not available from our data source yet." };
    }
    const months = monthsBetween(o.risk.launchedAt, now);
    const score = interpolate(months, [
      [0, 10],
      [3, 20],
      [6, 35],
      [12, 60],
      [24, 80],
      [36, 92],
      [48, 100],
    ]);
    const detail =
      months >= 24
        ? `Live for ${describeAge(months)}, through several market cycles.`
        : months >= 12
          ? `Live for ${describeAge(months)}. Established, but with a shorter track record.`
          : `Live for only ${describeAge(months)}. Less time to prove itself.`;
    return { score, detail };
  },
};

export const tvl: FactorDefinition = {
  id: "tvl",
  label: "Total value locked",
  weight: 12,
  evaluate(o) {
    const score = interpolateLog(o.tvlUsd, [
      [1e6, 10],
      [1e7, 40],
      [5e7, 60],
      [1e8, 72],
      [5e8, 88],
      [1e9, 95],
      [3e9, 100],
    ]);
    const size = formatCompactUsd(o.tvlUsd);
    const detail =
      score >= 85
        ? `${size} deposited. Large pools attract more scrutiny from security researchers.`
        : score >= 60
          ? `${size} deposited. A meaningful pool, though not among the largest.`
          : `${size} deposited. Smaller pools get less outside scrutiny.`;
    return { score, detail };
  },
};

export const liquidity: FactorDefinition = {
  id: "liquidity",
  label: "Liquidity",
  weight: 12,
  evaluate(o) {
    const depth = interpolateLog(o.liquidityUsd, [
      [1e6, 20],
      [1e7, 50],
      [5e7, 75],
      [2e8, 95],
      [5e8, 100],
    ]);
    const u = o.risk.utilization;
    // Without utilization we can't tell how close the pool is to running dry.
    const penalty =
      u === null
        ? 10
        : interpolate(u, [
            [0.8, 0],
            [0.9, 15],
            [0.95, 30],
            [1, 50],
          ]);
    const delay = o.risk.withdrawalDelayHours;
    const delayPenalty = interpolate(delay, [
      [0, 0],
      [24, 10],
      [24 * 14, 30],
    ]);
    const score = clamp(depth - penalty - delayPenalty);
    const available = formatCompactUsd(o.liquidityUsd);
    let detail =
      u === null
        ? `${available} available to withdraw right now. How much is lent out isn't reported.`
        : u >= 0.9
          ? `${formatPercent(u, 0)} of deposits are lent out. If more people want out at once, withdrawals may have to wait.`
          : `${available} available to withdraw right now (${formatPercent(u, 0)} of deposits are lent out).`;
    if (delay > 0) {
      const wait = delay >= 48 ? `${Math.round(delay / 24)} days` : `${delay} hours`;
      detail = `Withdrawals take about ${wait} to unlock. ${detail}`;
    }
    return { score, detail };
  },
};

export const smartContract: FactorDefinition = {
  id: "smartContract",
  label: "Smart contract security",
  weight: 14,
  evaluate(o) {
    const r = o.risk;
    let score =
      r.audits === null
        ? 40
        : interpolate(r.audits, [
            [0, 20],
            [1, 50],
            [2, 65],
            [3, 75],
            [4, 82],
          ]);
    const bounty = r.bugBountyUsd ?? 0;
    if (bounty >= 1_000_000) score += 10;
    else if (bounty >= 250_000) score += 6;
    else if (bounty > 0) score += 3;
    const authorityAdjust = { immutable: 8, "timelocked-multisig": 5, multisig: 0, "single-key": -20, unknown: -3 } as const;
    score += authorityAdjust[r.upgradeAuthority];
    if (r.openSource === false) score -= 10;

    const parts: string[] = [];
    parts.push(
      r.audits === null
        ? "Audit history not verified"
        : r.audits === 0
          ? "No public audits"
          : `${r.audits} public audit${r.audits === 1 ? "" : "s"}`,
    );
    if (r.bugBountyUsd === null) parts.push("bug bounty not verified");
    else if (r.bugBountyUsd > 0) parts.push(`${formatCompactUsd(r.bugBountyUsd)} bug bounty`);
    const authorityCopy = {
      immutable: "code can't be changed",
      "timelocked-multisig": "upgrades need a multisig and a waiting period",
      multisig: "upgrades need a multisig",
      "single-key": "a single key can change the code",
      unknown: "upgrade controls not verified",
    } as const;
    parts.push(authorityCopy[r.upgradeAuthority]);
    return {
      score: clamp(score),
      known: r.audits !== null,
      detail: `${capitalize(parts.join(", "))}. Audits reduce, but never remove, the chance of bugs.`,
    };
  },
};

export const complexity: FactorDefinition = {
  id: "complexity",
  label: "Strategy complexity",
  weight: 10,
  evaluate(o) {
    const base = { simple: 95, moderate: 72, complex: 45 } as const;
    let score: number = base[o.risk.strategyComplexity];
    if (o.risk.usesLeverage) score -= 15;
    const copy = {
      simple: "Simple lending: you supply stablecoins and borrowers pay interest.",
      moderate: "Several moving parts (for example, automated rebalancing between markets).",
      complex: "Complex strategy. Your deposit can be used to absorb other people's losses.",
    } as const;
    const detail = copy[o.risk.strategyComplexity] + (o.risk.usesLeverage ? " Uses leverage." : "");
    return { score: clamp(score), detail };
  },
};

export const incidents: FactorDefinition = {
  id: "incidents",
  label: "Incident history",
  weight: 12,
  evaluate(o, now) {
    const list = o.risk.incidents;
    if (list.length === 0) {
      if (o.risk.incidentsReviewed === false) {
        return {
          score: UNKNOWN_SCORE + 15,
          known: false,
          detail: "Incident history not reviewed by StableSave yet. Check the protocol's track record before depositing.",
        };
      }
      return { score: 100, detail: "No security incidents in this dataset." };
    }
    let penalty = 0;
    for (const incident of list) {
      const ageYears = monthsBetween(incident.date, now) / 12;
      let p = { minor: 10, major: 30, critical: 50 }[incident.severity];
      if (incident.fundsLost && !incident.usersReimbursed) p *= 1.5;
      else if (incident.usersReimbursed) p *= 0.7;
      p *= Math.max(0.3, 1 - ageYears / 4);
      penalty += p;
    }
    const worst = [...list].sort((a, b) => (b.date > a.date ? 1 : -1))[0]!;
    const detail = `${list.length} past incident${list.length === 1 ? "" : "s"}. Most recent: ${worst.summary}`;
    return { score: clamp(100 - penalty, 5), detail };
  },
};

export const yieldVolatility: FactorDefinition = {
  id: "yieldVolatility",
  label: "Yield stability",
  weight: 8,
  evaluate(o) {
    const rewardShare = o.yield.totalApy > 0 ? o.yield.rewardApy / o.yield.totalApy : 0;
    if (o.risk.apyHistory30d.length < 5) {
      return {
        score: UNKNOWN_SCORE - (rewardShare > 0.3 ? 10 : 0),
        known: false,
        detail: "Not enough rate history to judge how stable this rate is.",
      };
    }
    const sdPoints = standardDeviation(o.risk.apyHistory30d) * 100;
    let score = interpolate(sdPoints, [
      [0, 100],
      [0.25, 95],
      [0.5, 88],
      [1, 75],
      [2, 55],
      [4, 30],
      [8, 10],
    ]);
    if (rewardShare > 0.5) score -= 20;
    else if (rewardShare > 0.3) score -= 10;
    const swing = `Moved about ±${sdPoints.toFixed(1)} points over 30 days.`;
    const rewards =
      rewardShare > 0.3
        ? ` ${formatPercent(rewardShare, 0)} of the rate comes from token rewards, which can end at any time.`
        : "";
    const lead = sdPoints < 1 ? "Steady rate." : sdPoints < 2.5 ? "Rate moves around." : "Rate swings a lot.";
    return { score: clamp(score), detail: `${lead} ${swing}${rewards}` };
  },
};

export const oracle: FactorDefinition = {
  id: "oracle",
  label: "Oracle dependencies",
  weight: 9,
  evaluate(o) {
    if (o.risk.oracleSetup === "unknown") {
      return { score: UNKNOWN_SCORE, known: false, detail: "Price-feed (oracle) setup not verified." };
    }
    const base = { none: 100, redundant: 85, single: 65 } as const;
    let score: number = base[o.risk.oracleSetup];
    if (o.risk.usesLeverage) score -= 10;
    const names = o.risk.oracles.join(" and ");
    const detail =
      o.risk.oracleSetup === "none"
        ? "Doesn't rely on external price feeds."
        : o.risk.oracleSetup === "redundant"
          ? `Uses several price feeds (${names}), so one bad price is less likely to cause bad loans.`
          : `Relies on a single price feed (${names}). A wrong price could lead to bad loans.`;
    return { score: clamp(score), detail };
  },
};

export const concentration: FactorDefinition = {
  id: "concentration",
  label: "Concentration",
  weight: 9,
  evaluate(o) {
    const { topDepositorsShare: top, collateralConcentration: collateral } = o.risk;
    if (top === null && collateral === null) {
      return { score: UNKNOWN_SCORE, known: false, detail: "Depositor and collateral concentration data not available yet." };
    }
    const depositors =
      top === null
        ? UNKNOWN_SCORE + 10
        : interpolate(top, [
            [0.2, 100],
            [0.5, 60],
            [0.8, 25],
          ]);
    const collateralPenalty =
      collateral === null
        ? 5
        : interpolate(collateral, [
            [0.3, 0],
            [0.6, 15],
            [0.9, 35],
          ]);
    const score = clamp(depositors - collateralPenalty);
    const parts = [top === null ? "Depositor concentration not reported" : `Top 10 depositors hold ${formatPercent(top, 0)}`];
    if (collateral !== null && collateral >= 0.6)
      parts.push(`${formatPercent(collateral, 0)} of loans lean on a single collateral asset`);
    return { score, detail: `${parts.join("; ")}.` };
  },
};

export const FACTORS: readonly FactorDefinition[] = [
  maturity,
  tvl,
  liquidity,
  smartContract,
  complexity,
  incidents,
  yieldVolatility,
  oracle,
  concentration,
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
