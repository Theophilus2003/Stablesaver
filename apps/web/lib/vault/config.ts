import type { ProtocolId } from "@stablesave/core";

/**
 * Limits the preview simulates. They mirror the parameters an operator would
 * pass to `initialize_vault` (see programs/stablesave-vault/tests/vault.rs);
 * a deployed vault's own on-chain limits always take precedence.
 */
export const PREVIEW_LIMITS = {
  /** Per-position instant withdrawals per window (USD). */
  largeWithdrawalThreshold: 2_000,
  withdrawalTimelockSeconds: 30 * 60,
  windowSeconds: 24 * 60 * 60,
  minDeposit: 1,
};

/**
 * The on-chain strategy stores protocols, not markets. For estimates we price
 * each protocol at its main USDC market.
 */
export const DEFAULT_USDC_MARKET: Record<ProtocolId, string> = {
  kamino: "kamino-main-usdc",
  marginfi: "marginfi-global-usdc",
  drift: "drift-spot-usdc",
  save: "save-main-usdc",
};

export const USDC_MINTS = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
} as const;
