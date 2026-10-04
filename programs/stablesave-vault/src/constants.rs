use anchor_lang::prelude::*;

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const RESERVE_SEED: &[u8] = b"reserve";
#[constant]
pub const POSITION_SEED: &[u8] = b"position";

/// Maximum number of protocol allocations in a strategy.
#[constant]
pub const MAX_ALLOCATIONS: u8 = 8;
pub const MAX_ALLOCATIONS_USIZE: usize = MAX_ALLOCATIONS as usize;

/// 100% in basis points.
pub const BPS_DENOMINATOR: u16 = 10_000;

/// Number of risk profiles (0 = play it safe, 1 = balanced, 2 = go bigger).
pub const RISK_PROFILE_COUNT: u8 = 3;

/// USDC and USDT on Solana both use 6 decimals. Anything else is rejected.
pub const REQUIRED_MINT_DECIMALS: u8 = 6;

/// Virtual shares/assets added to the exchange rate so the first depositor
/// can't inflate the share price and round later deposits down to zero.
pub const VIRTUAL_SHARES: u128 = 1_000;
pub const VIRTUAL_ASSETS: u128 = 1;

/// Timelock bounds for large withdrawals.
pub const MIN_TIMELOCK_SECONDS: i64 = 60;
pub const MAX_TIMELOCK_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Bounds for the rolling window used by instant-withdrawal limits.
pub const MIN_WINDOW_SECONDS: i64 = 60 * 60;
pub const MAX_WINDOW_SECONDS: i64 = 7 * 24 * 60 * 60;

pub const ACCOUNT_VERSION: u8 = 1;
