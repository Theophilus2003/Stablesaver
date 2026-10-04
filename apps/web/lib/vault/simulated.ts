import type { RatedOpportunity, RiskProfile } from "@stablesave/core";
import { readJson, removeStorage, writeJson } from "@/lib/storage";
import { PREVIEW_LIMITS } from "./config";
import { blendFor, positionsFromBlend, type HistoryPoint, type Portfolio } from "./portfolio";

/**
 * Simulated vault for preview mode. Lives only in this browser, is always
 * labelled "Simulated", and never touches a wallet or the network.
 */

const STORAGE_KEY = "stablesave:simulated-vault:v1";
const DAY = 86_400_000;

interface Flow {
  at: number;
  amount: number;
}

export interface SimulatedVaultState {
  profile: RiskProfile;
  deposits: Flow[];
  /** Completed withdrawals (principal + yield). */
  withdrawals: Flow[];
  /** Instant withdrawals inside the current window, for the per-day limit. */
  windowStart: number;
  windowWithdrawn: number;
  pending: { amount: number; requestedAt: number; unlockAt: number } | null;
}

/** First visit: an illustrative $10,000 balanced deposit made 356 days ago. */
export function defaultSimulatedState(now = Date.now()): SimulatedVaultState {
  return {
    profile: "balanced",
    deposits: [{ at: now - 356 * DAY, amount: 10_000 }],
    withdrawals: [],
    windowStart: 0,
    windowWithdrawn: 0,
    pending: null,
  };
}

export function loadSimulatedState(): SimulatedVaultState {
  return readJson<SimulatedVaultState>(STORAGE_KEY) ?? defaultSimulatedState();
}

export function saveSimulatedState(state: SimulatedVaultState) {
  writeJson(STORAGE_KEY, state);
}

export function resetSimulatedState() {
  removeStorage(STORAGE_KEY);
}

/** Balance at `t`, compounding each flow at `apy` (constant: today's estimate). */
function balanceAt(state: SimulatedVaultState, apy: number, t: number): number {
  // A withdrawal compounds as a negative flow, so later growth isn't overstated.
  const grow = (flow: Flow) => (t <= flow.at ? 0 : flow.amount * Math.pow(1 + apy, (t - flow.at) / (365 * DAY)));
  const deposited = state.deposits.reduce((s, f) => s + grow(f), 0);
  const withdrawn = state.withdrawals.reduce((s, f) => s + grow(f), 0);
  return Math.max(0, deposited - withdrawn);
}

function principalAt(state: SimulatedVaultState, t: number): number {
  const d = state.deposits.filter((f) => f.at <= t).reduce((s, f) => s + f.amount, 0);
  const w = state.withdrawals.filter((f) => f.at <= t).reduce((s, f) => s + f.amount, 0);
  return d - w;
}

export function simulatedPortfolio(
  state: SimulatedVaultState,
  opportunities: readonly RatedOpportunity[],
  now = Date.now(),
): Portfolio | null {
  const probe = blendFor(state.profile, opportunities, 1);
  if (!probe) return null;
  const apy = probe.apy;

  const total = balanceAt(state, apy, now);
  const pendingAmount = state.pending?.amount ?? 0;
  const balance = Math.max(0, total);
  const earned = balance - principalAt(state, now);

  const start = state.deposits.length ? Math.min(...state.deposits.map((d) => d.at)) : now;
  const span = Math.max(DAY, now - start);
  const steps = 60;
  const history: HistoryPoint[] = Array.from({ length: steps + 1 }, (_, i) => {
    const t = start + (span * i) / steps;
    const b = balanceAt(state, apy, t);
    return { t, balance: b, earned: b - principalAt(state, t) };
  });

  const windowActive = now < state.windowStart + PREVIEW_LIMITS.windowSeconds * 1000;
  const usedToday = windowActive ? state.windowWithdrawn : 0;
  const instantAvailable = Math.max(0, Math.min(PREVIEW_LIMITS.largeWithdrawalThreshold - usedToday, balance - pendingAmount));

  const blend = blendFor(state.profile, opportunities, balance)!;
  return {
    source: "simulated",
    profile: state.profile,
    balance,
    earned,
    apy,
    grade: blend.safety.display,
    allocations: blend.strategy.allocations,
    positions: positionsFromBlend(blend, balance),
    history,
    pending: state.pending,
    instantAvailable,
    limits: PREVIEW_LIMITS,
    hasDeposits: balance > 0.005,
  };
}

/** Apply a simulated deposit. Switching profile re-allocates the whole balance. */
export function simulateDeposit(state: SimulatedVaultState, amount: number, profile: RiskProfile, now = Date.now()): SimulatedVaultState {
  return { ...state, profile, deposits: [...state.deposits, { at: now, amount }] };
}

export function simulateInstantWithdrawal(state: SimulatedVaultState, amount: number, now = Date.now()): SimulatedVaultState {
  const windowActive = now < state.windowStart + PREVIEW_LIMITS.windowSeconds * 1000;
  return {
    ...state,
    withdrawals: [...state.withdrawals, { at: now, amount }],
    windowStart: windowActive ? state.windowStart : now,
    windowWithdrawn: (windowActive ? state.windowWithdrawn : 0) + amount,
  };
}

export function simulateRequest(state: SimulatedVaultState, amount: number, now = Date.now()): SimulatedVaultState {
  return {
    ...state,
    pending: { amount, requestedAt: now, unlockAt: now + PREVIEW_LIMITS.withdrawalTimelockSeconds * 1000 },
  };
}

export function simulateExecute(state: SimulatedVaultState, now = Date.now()): SimulatedVaultState {
  if (!state.pending || now < state.pending.unlockAt) return state;
  return { ...state, withdrawals: [...state.withdrawals, { at: now, amount: state.pending.amount }], pending: null };
}

export function simulateCancel(state: SimulatedVaultState): SimulatedVaultState {
  return { ...state, pending: null };
}
