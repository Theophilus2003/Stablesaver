import type { StableAsset } from "./types";

/** Stablecoin mints on Solana mainnet, by asset. */
export const SOLANA_STABLECOIN_MINTS: Record<StableAsset, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export interface WalletStablecoins {
  address: string;
  balances: Record<StableAsset, number>;
  /** USDC + USDT, counted at $1 each. */
  totalUsd: number;
  /** The stablecoin the wallet holds most of. */
  largest: StableAsset;
  fetchedAt: string;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Cheap shape check before asking an RPC node. The node does the real validation. */
export function looksLikeSolanaAddress(value: string): boolean {
  return BASE58.test(value.trim());
}

/**
 * Sums `uiAmount` across token accounts from a `getTokenAccountsByOwner`
 * response (jsonParsed encoding). Returns null for an RPC error or an
 * unexpected shape, so callers never show a made-up balance.
 */
export function sumTokenAccounts(response: unknown): number | null {
  if (!response || typeof response !== "object") return null;
  const r = response as { result?: { value?: unknown }; error?: unknown };
  if (r.error || !r.result || !Array.isArray(r.result.value)) return null;
  let total = 0;
  for (const entry of r.result.value) {
    const amount = (entry as { account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown; decimals?: unknown } } } } } })
      ?.account?.data?.parsed?.info?.tokenAmount;
    if (!amount) return null;
    const raw = typeof amount.amount === "string" ? Number(amount.amount) : NaN;
    const decimals = typeof amount.decimals === "number" ? amount.decimals : NaN;
    if (!Number.isFinite(raw) || !Number.isInteger(decimals)) return null;
    total += raw / 10 ** decimals;
  }
  return total;
}

export function summarizeWallet(address: string, balances: Record<StableAsset, number>, fetchedAt = new Date().toISOString()): WalletStablecoins {
  const totalUsd = balances.USDC + balances.USDT;
  return { address, balances, totalUsd, largest: balances.USDT > balances.USDC ? "USDT" : "USDC", fetchedAt };
}
