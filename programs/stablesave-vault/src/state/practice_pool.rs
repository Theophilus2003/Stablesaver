use crate::constants::*;
use crate::error::VaultError;
use crate::state::Protocol;
use anchor_lang::prelude::*;

/// A practice lending pool for one protocol in one vault: the vault moves part
/// of its reserve here according to the strategy weights, and the pool pays a
/// fixed practice rate funded from the vault's yield-sponsor account. It stands
/// in for a real protocol (Kamino, MarginFi, …) until CPI integrations ship, and
/// keeps the accounting honest: every unit counted is a real token held here.
///
/// PDA: ["pool", vault, protocol index]
#[account]
#[derive(InitSpace)]
pub struct PracticePool {
    pub version: u8,
    pub bump: u8,
    pub tokens_bump: u8,
    pub vault: Pubkey,
    pub protocol: Protocol,
    /// Token account holding this pool's funds. PDA: ["pool_tokens", pool]; authority = vault.
    pub tokens: Pubkey,
    /// Fixed practice rate, basis points a year.
    pub apy_bps: u16,
    /// Vault assets in this pool: principal moved in plus interest paid in.
    pub deployed: u64,
    /// Interest paid into the pool so far.
    pub interest_paid: u64,
    pub last_accrual_ts: i64,
    pub created_at: i64,
}

/// Movement `rebalance` makes for one pool, in token base units.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Move {
    ToPool(u64),
    ToReserve(u64),
    None,
}

/// Target for a pool: its strategy weight of the vault's assets, after keeping
/// `LIQUIDITY_BUFFER_BPS` liquid. Moving money in never takes the reserve below
/// that buffer; moving money out is always allowed.
pub fn rebalance_move(reserve: u64, deployed_total: u64, pool_deployed: u64, weight_bps: u16) -> Result<Move> {
    let bps = BPS_DENOMINATOR as u128;
    let total = (reserve as u128)
        .checked_add(deployed_total as u128)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    let buffer = total * LIQUIDITY_BUFFER_BPS as u128 / bps;
    let target = (total - buffer) * weight_bps as u128 / bps;
    let current = pool_deployed as u128;
    let movement = if target > current {
        let spare = (reserve as u128).saturating_sub(buffer);
        let amount = (target - current).min(spare);
        if amount == 0 { Move::None } else { Move::ToPool(amount as u64) }
    } else if current > target {
        Move::ToReserve((current - target) as u64)
    } else {
        Move::None
    };
    Ok(movement)
}

/// Simple interest owed for `elapsed` seconds at `apy_bps` on `deployed`, rounded down.
pub fn accrued_interest(deployed: u64, apy_bps: u16, elapsed: i64) -> Result<u64> {
    if deployed == 0 || apy_bps == 0 || elapsed <= 0 {
        return Ok(0);
    }
    let numerator = (deployed as u128)
        .checked_mul(apy_bps as u128)
        .and_then(|v| v.checked_mul(elapsed as u128))
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    let interest = numerator / (BPS_DENOMINATOR as u128 * SECONDS_PER_YEAR as u128);
    u64::try_from(interest).map_err(|_| error!(VaultError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    const USDC: u64 = 1_000_000;

    #[test]
    fn moves_toward_the_weight_after_the_buffer() {
        // 10,000 in the reserve, nothing deployed, 45% weight: 80% investable → 3,600.
        assert_eq!(rebalance_move(10_000 * USDC, 0, 0, 4_500).unwrap(), Move::ToPool(3_600 * USDC));
        // Already at target.
        assert_eq!(rebalance_move(6_400 * USDC, 3_600 * USDC, 3_600 * USDC, 4_500).unwrap(), Move::None);
    }

    #[test]
    fn never_dips_into_the_buffer() {
        // Reserve holds exactly the 20% buffer: nothing more can go out.
        assert_eq!(rebalance_move(2_000 * USDC, 8_000 * USDC, 0, 10_000).unwrap(), Move::None);
        // Only 500 above the buffer.
        assert_eq!(rebalance_move(2_500 * USDC, 7_500 * USDC, 0, 10_000).unwrap(), Move::ToPool(500 * USDC));
    }

    #[test]
    fn pulls_back_when_over_weight_or_dropped() {
        // Weight cut to 0: everything comes back.
        assert_eq!(rebalance_move(5_000 * USDC, 5_000 * USDC, 5_000 * USDC, 0).unwrap(), Move::ToReserve(5_000 * USDC));
        // After a big withdrawal shrank the vault: 2,000 total, 50% weight → target 800.
        assert_eq!(rebalance_move(500 * USDC, 1_500 * USDC, 1_500 * USDC, 5_000).unwrap(), Move::ToReserve(700 * USDC));
    }

    #[test]
    fn interest_is_simple_and_rounds_down() {
        // 10,000 at 5% for a year = 500.
        assert_eq!(accrued_interest(10_000 * USDC, 500, SECONDS_PER_YEAR).unwrap(), 500 * USDC);
        // One day.
        assert_eq!(accrued_interest(10_000 * USDC, 500, 86_400).unwrap(), 1_369_863);
        assert_eq!(accrued_interest(0, 500, 86_400).unwrap(), 0);
        assert_eq!(accrued_interest(10_000 * USDC, 500, -5).unwrap(), 0);
    }
}
