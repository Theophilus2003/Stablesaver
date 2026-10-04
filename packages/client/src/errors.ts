import {
  STABLESAVE_VAULT_ERROR__BELOW_MINIMUM_DEPOSIT,
  STABLESAVE_VAULT_ERROR__DEPOSIT_CAP_EXCEEDED,
  STABLESAVE_VAULT_ERROR__INSUFFICIENT_LIQUIDITY,
  STABLESAVE_VAULT_ERROR__INSUFFICIENT_SHARES,
  STABLESAVE_VAULT_ERROR__INVALID_TOKEN_ACCOUNT,
  STABLESAVE_VAULT_ERROR__LARGE_WITHDRAWAL_REQUIRES_TIMELOCK,
  STABLESAVE_VAULT_ERROR__NO_PENDING_WITHDRAWAL,
  STABLESAVE_VAULT_ERROR__SLIPPAGE_EXCEEDED,
  STABLESAVE_VAULT_ERROR__TIMELOCK_ACTIVE,
  STABLESAVE_VAULT_ERROR__UNAUTHORIZED,
  STABLESAVE_VAULT_ERROR__UNSUPPORTED_MINT,
  STABLESAVE_VAULT_ERROR__VAULT_OUTFLOW_LIMIT_REACHED,
  STABLESAVE_VAULT_ERROR__VAULT_PAUSED,
  STABLESAVE_VAULT_ERROR__WITHDRAWAL_ALREADY_PENDING,
  STABLESAVE_VAULT_ERROR__ZERO_AMOUNT,
  STABLESAVE_VAULT_ERROR__ZERO_SHARES,
} from "./generated";

/**
 * User-facing copy for program errors. The generated messages are stripped
 * from production bundles, and are written for developers anyway.
 */
const FRIENDLY: Record<number, string> = {
  [STABLESAVE_VAULT_ERROR__VAULT_PAUSED]: "The vault is paused for safety. Your funds stay put; try again once it reopens.",
  [STABLESAVE_VAULT_ERROR__BELOW_MINIMUM_DEPOSIT]: "That's below the vault's minimum deposit.",
  [STABLESAVE_VAULT_ERROR__DEPOSIT_CAP_EXCEEDED]: "The vault is full right now. Try a smaller amount.",
  [STABLESAVE_VAULT_ERROR__SLIPPAGE_EXCEEDED]: "The vault's share price moved while you were signing. Please try again.",
  [STABLESAVE_VAULT_ERROR__INSUFFICIENT_SHARES]: "You don't have that much in this vault.",
  [STABLESAVE_VAULT_ERROR__INSUFFICIENT_LIQUIDITY]: "The vault doesn't have enough cash on hand for this right now. Try a smaller amount or request a timelocked withdrawal.",
  [STABLESAVE_VAULT_ERROR__LARGE_WITHDRAWAL_REQUIRES_TIMELOCK]: "This is above your instant limit. Request a timelocked withdrawal for the rest.",
  [STABLESAVE_VAULT_ERROR__VAULT_OUTFLOW_LIMIT_REACHED]: "The vault's instant-withdrawal limit for today has been reached. Request a timelocked withdrawal instead.",
  [STABLESAVE_VAULT_ERROR__WITHDRAWAL_ALREADY_PENDING]: "You already have a withdrawal waiting. Complete or cancel it first.",
  [STABLESAVE_VAULT_ERROR__NO_PENDING_WITHDRAWAL]: "There's no withdrawal waiting.",
  [STABLESAVE_VAULT_ERROR__TIMELOCK_ACTIVE]: "The timelock hasn't finished yet.",
  [STABLESAVE_VAULT_ERROR__ZERO_AMOUNT]: "Enter an amount greater than zero.",
  [STABLESAVE_VAULT_ERROR__ZERO_SHARES]: "That amount is too small.",
  [STABLESAVE_VAULT_ERROR__UNSUPPORTED_MINT]: "This token isn't supported by the vault.",
  [STABLESAVE_VAULT_ERROR__INVALID_TOKEN_ACCOUNT]: "Your token account doesn't match this vault.",
  [STABLESAVE_VAULT_ERROR__UNAUTHORIZED]: "This wallet isn't allowed to do that.",
};

export function describeVaultError(code: number): string | null {
  return FRIENDLY[code] ?? null;
}

/** Pull a custom program error code out of a wallet / RPC error message. */
export function extractCustomErrorCode(message: string): number | null {
  const hex = message.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) return parseInt(hex[1]!, 16);
  const json = message.match(/"Custom":\s*(\d+)/);
  if (json) return Number(json[1]);
  return null;
}
