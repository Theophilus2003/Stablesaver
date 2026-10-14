"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { EXAMPLE_VAULT_STRATEGIES, type RatedOpportunity, type RiskProfile, type VaultStrategy } from "@stablesave/core";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import {
  cancelOnchain,
  depositOnchain,
  executeOnchain,
  loadVaults,
  syncPoolsOnchain,
  onchainPortfolio,
  walletTokenBalance,
  strategyFromVault,
  withdrawOnchain,
  type OnchainVaultState,
  type SendContext,
} from "@/lib/vault/onchain";
import { PREVIEW_LIMITS } from "@/lib/vault/config";
import type { Portfolio } from "@/lib/vault/portfolio";
import {
  loadSimulatedState,
  resetSimulatedState,
  saveSimulatedState,
  simulateCancel,
  simulateDeposit,
  simulateExecute,
  simulateInstantWithdrawal,
  simulateRequest,
  simulatedPortfolio,
  type SimulatedVaultState,
} from "@/lib/vault/simulated";

export type VaultMode = "simulated" | "onchain";

export interface ActionResult {
  signature?: string;
  instant?: number;
  timelocked?: number;
}

export interface VaultController {
  mode: VaultMode;
  ready: boolean;
  error: string | null;
  portfolio: Portfolio | null;
  /** On-chain with a wallet connected: how much of the vault token the wallet holds. Otherwise null. */
  walletBalance: number | null;
  /** On-chain: vaults that exist for the configured mint. */
  availableProfiles: RiskProfile[];
  /** Example weights in preview; the vault's on-chain weights once deployed. */
  strategyFor: (profile: RiskProfile) => VaultStrategy;
  limits: Portfolio["limits"] & { minDeposit: number };
  deposit: (amount: number, profile: RiskProfile) => Promise<ActionResult>;
  withdraw: (amount: number) => Promise<ActionResult>;
  execute: () => Promise<ActionResult>;
  cancel: () => Promise<ActionResult>;
  /** On-chain with practice pools: collect interest and rebalance. */
  sync?: () => Promise<ActionResult>;
  reset: () => void;
  refresh: () => void;
}

/**
 * One interface for the vault UI. Without a deployed program it runs a
 * clearly-labelled simulation in this browser; with one, it reads accounts
 * and sends real transactions on the configured cluster.
 */
export function useVault(opportunities: readonly RatedOpportunity[]): VaultController {
  const env = useEnvironment();
  // `vaultDeployed` comes from build-time env and never changes at runtime, so
  // the hook order is stable.
  return env.vaultDeployed ? useOnchainVault(opportunities) : useSimulatedVault(opportunities);
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useSimulatedVault(opportunities: readonly RatedOpportunity[]): VaultController {
  const [state, setState] = React.useState<SimulatedVaultState | null>(null);
  const now = useNow(1000);

  React.useEffect(() => setState(loadSimulatedState()), []);

  const update = React.useCallback((next: SimulatedVaultState) => {
    saveSimulatedState(next);
    setState(next);
  }, []);

  // Recompute at most every 5s for smooth-but-cheap balance ticks; countdowns use their own clock.
  const bucket = Math.floor(now / 5000);
  const portfolio = React.useMemo(
    () => (state ? simulatedPortfolio(state, opportunities, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, opportunities, bucket],
  );

  return {
    mode: "simulated",
    ready: state !== null,
    error: null,
    portfolio,
    walletBalance: null,
    availableProfiles: ["safe", "balanced", "bigger"],
    strategyFor: (profile) => EXAMPLE_VAULT_STRATEGIES[profile],
    limits: PREVIEW_LIMITS,
    async deposit(amount, profile) {
      const base = state ?? loadSimulatedState();
      update(simulateDeposit(base, amount, profile));
      return {};
    },
    async withdraw(amount) {
      if (!state || !portfolio) throw new Error("Vault not ready");
      const instant = Math.min(amount, portfolio.instantAvailable);
      const timelocked = state.pending ? 0 : Math.max(0, Math.min(amount, portfolio.balance) - instant);
      let next = state;
      if (instant > 0) next = simulateInstantWithdrawal(next, instant);
      if (timelocked > 0) next = simulateRequest(next, timelocked);
      update(next);
      return { instant, timelocked };
    },
    async execute() {
      if (state) update(simulateExecute(state));
      return {};
    },
    async cancel() {
      if (state) update(simulateCancel(state));
      return {};
    },
    reset() {
      resetSimulatedState();
      setState(loadSimulatedState());
    },
    refresh() {
      setState(loadSimulatedState());
    },
  };
}

function useOnchainVault(opportunities: readonly RatedOpportunity[]): VaultController {
  const env = useEnvironment();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const owner = publicKey?.toBase58();
  const [vaults, setVaults] = React.useState<OnchainVaultState[] | null>(null);
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const config = React.useMemo(
    () => ({ rpcUrl: env.rpcUrl, programId: env.vaultProgramId!, mint: env.vaultMint! }),
    [env.rpcUrl, env.vaultProgramId, env.vaultMint],
  );

  React.useEffect(() => {
    let cancelled = false;
    loadVaults(config, owner)
      .then((v) => {
        if (!cancelled) {
          setVaults(v);
          setError(v.length === 0 ? "No StableSave vaults found for this token on this cluster." : null);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    if (owner) {
      walletTokenBalance(config, owner)
        .then((b) => !cancelled && setWalletBalance(b))
        .catch(() => !cancelled && setWalletBalance(null));
    } else {
      setWalletBalance(null);
    }
    return () => {
      cancelled = true;
    };
  }, [config, owner, tick]);

  // Show the vault the user holds the most in; otherwise the balanced one.
  const active = React.useMemo(() => {
    if (!vaults?.length) return null;
    const held = vaults.filter((v) => v.position && (v.position.shares > 0n || v.position.pendingShares > 0n));
    return (
      held.sort((a, b) => Number((b.position!.shares + b.position!.pendingShares) - (a.position!.shares + a.position!.pendingShares)))[0] ??
      vaults.find((v) => v.profile === "balanced") ??
      vaults[0]!
    );
  }, [vaults]);

  const portfolio = React.useMemo(() => (active ? onchainPortfolio(active, opportunities) : null), [active, opportunities]);

  function ctx(): SendContext {
    if (!owner) throw new Error("Connect a wallet first.");
    return { connection, owner, mint: config.mint, sendTransaction: (tx, c) => sendTransaction(tx, c) };
  }
  const refresh = () => setTick((t) => t + 1);

  return {
    mode: "onchain",
    ready: vaults !== null || error !== null,
    error,
    portfolio,
    walletBalance,
    availableProfiles: (vaults ?? []).map((v) => v.profile),
    strategyFor(profile) {
      const target = vaults?.find((v) => v.profile === profile);
      return target ? strategyFromVault(target) : EXAMPLE_VAULT_STRATEGIES[profile];
    },
    limits: portfolio ? { ...portfolio.limits, minDeposit: active ? Number(active.vault.limits.minDeposit) / 1e6 : 1 } : PREVIEW_LIMITS,
    async deposit(amount, profile) {
      const target = vaults?.find((v) => v.profile === profile);
      if (!target) throw new Error("This risk level isn't open on this cluster yet.");
      const signature = await depositOnchain(ctx(), target, amount);
      refresh();
      return { signature };
    },
    async withdraw(amount) {
      if (!active) throw new Error("No vault loaded.");
      const { signature, plan } = await withdrawOnchain(ctx(), active, amount);
      refresh();
      return { signature, instant: Number(plan.instant) / 1e6, timelocked: Number(plan.timelocked) / 1e6 };
    },
    async execute() {
      if (!active) throw new Error("No vault loaded.");
      const signature = await executeOnchain(ctx(), active);
      refresh();
      return { signature };
    },
    async cancel() {
      if (!active) throw new Error("No vault loaded.");
      const signature = await cancelOnchain(ctx(), active);
      refresh();
      return { signature };
    },
    sync:
      active && active.pools.length > 0
        ? async () => {
            const signature = await syncPoolsOnchain(ctx(), active);
            refresh();
            return { signature };
          }
        : undefined,
    reset() {},
    refresh,
  };
}
