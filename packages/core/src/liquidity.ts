import { formatCompactUsd, formatPercent } from "./format";
import type { Opportunity } from "./types";

/**
 * "Can I withdraw today?" for a given amount.
 *
 * - `ready`: plenty is free to withdraw right now.
 * - `likely`: fine for this amount, but the pool is busy or the amount is a noticeable slice of what's free.
 * - `tight`: the amount is a large share of what's free, or almost everything is lent out.
 * - `wait`: withdrawals always take time (e.g. an unstaking cooldown).
 * - `unknown`: the data source doesn't report how much is lent out.
 */
export type WithdrawStatus = "ready" | "likely" | "tight" | "wait" | "unknown";

export interface WithdrawalCheck {
  status: WithdrawStatus;
  /** Short answer, e.g. "Yes, today". */
  answer: string;
  /** One or two plain-English sentences. */
  detail: string;
  /** Funds free to withdraw right now, when known. */
  availableUsd: number | null;
  /** Share of the pool that is lent out (0..1), when known. */
  utilization: number | null;
  /** The amount as a share of what's free right now, when known. */
  shareOfAvailable: number | null;
}

/** Above this share of the pool lent out, withdrawals can queue. */
export const BUSY_UTILIZATION = 0.9;
export const FULL_UTILIZATION = 0.97;
/** The amount as a share of free funds above which we stop saying "easily". */
export const NOTICEABLE_SHARE = 0.1;
export const LARGE_SHARE = 0.5;

export function checkWithdrawal(o: Pick<Opportunity, "liquidityUsd" | "risk">, amount: number): WithdrawalCheck {
  const delayHours = o.risk.withdrawalDelayHours;
  const utilization = o.risk.utilization;
  const availableUsd = utilization === null ? null : Math.max(0, o.liquidityUsd);
  const shareOfAvailable =
    availableUsd === null ? null : amount <= 0 ? 0 : availableUsd > 0 ? amount / availableUsd : Number.POSITIVE_INFINITY;

  if (delayHours > 0) {
    const days = Math.max(1, Math.round(delayHours / 24));
    return {
      status: "wait",
      answer: "Not the same day",
      detail: `Withdrawals take about ${days} ${days === 1 ? "day" : "days"} to arrive: there's a set waiting period before money comes out.`,
      availableUsd,
      utilization,
      shareOfAvailable,
    };
  }

  if (availableUsd === null || utilization === null || shareOfAvailable === null) {
    return {
      status: "unknown",
      answer: "Not reported",
      detail: "The data source doesn't say how much of this pool is lent out, so we can't check how much is free to withdraw.",
      availableUsd,
      utilization,
      shareOfAvailable,
    };
  }

  const free = formatCompactUsd(availableUsd);
  const lent = formatPercent(utilization, 0);

  if (utilization >= FULL_UTILIZATION || shareOfAvailable > LARGE_SHARE) {
    return {
      status: "tight",
      answer: "Maybe not all at once",
      detail:
        shareOfAvailable > LARGE_SHARE
          ? `Only ${free} is free right now, and your amount is a large part of that. You might have to withdraw in pieces or wait for borrowers to repay.`
          : `${lent} of this pool is lent out, leaving ${free} free. If many people withdraw at once, you may have to wait for borrowers to repay.`,
      availableUsd,
      utilization,
      shareOfAvailable,
    };
  }

  if (utilization >= BUSY_UTILIZATION || shareOfAvailable > NOTICEABLE_SHARE) {
    return {
      status: "likely",
      answer: "Probably, yes",
      detail: `${free} is free right now, enough for your amount. ${lent} of the pool is lent out, so very large withdrawals can be delayed.`,
      availableUsd,
      utilization,
      shareOfAvailable,
    };
  }

  return {
    status: "ready",
    answer: "Yes, today",
    detail: `${free} is free to withdraw right now, far more than your amount. ${lent} of the pool is lent out.`,
    availableUsd,
    utilization,
    shareOfAvailable,
  };
}
