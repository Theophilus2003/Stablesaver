//! Share accounting. Pure functions, unit-tested on the host.
//!
//! The vault issues shares against its assets. Both conversions round down,
//! which always favours the vault (and therefore the remaining depositors).

use crate::constants::{VIRTUAL_ASSETS, VIRTUAL_SHARES};
use crate::error::VaultError;
use anchor_lang::prelude::*;

/// floor(a * b / denominator) in u128 with overflow checks.
pub fn mul_div_floor(a: u128, b: u128, denominator: u128) -> Result<u128> {
    require!(denominator > 0, VaultError::MathOverflow);
    a.checked_mul(b)
        .and_then(|product| product.checked_div(denominator))
        .ok_or_else(|| error!(VaultError::MathOverflow))
}

fn to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| error!(VaultError::MathOverflow))
}

/// Shares minted for depositing `assets` into a vault holding `total_assets`
/// backed by `total_shares`.
pub fn shares_for_deposit(assets: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    let numerator = (total_shares as u128)
        .checked_add(VIRTUAL_SHARES)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    let denominator = (total_assets as u128)
        .checked_add(VIRTUAL_ASSETS)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    to_u64(mul_div_floor(assets as u128, numerator, denominator)?)
}

/// Assets paid out for redeeming `shares`.
pub fn assets_for_shares(shares: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    let numerator = (total_assets as u128)
        .checked_add(VIRTUAL_ASSETS)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    let denominator = (total_shares as u128)
        .checked_add(VIRTUAL_SHARES)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    to_u64(mul_div_floor(shares as u128, numerator, denominator)?)
}

/// Fixed rolling window: resets when `now` is at least `window_seconds` past
/// `start`. Returns the (possibly reset) start and amount.
///
/// A fresh account has `start == 0`, which is always more than a window ago
/// on a real cluster. `0` is not treated as "unset": a cluster clock at 0
/// (as in tests) must not reset the window on every call.
pub fn roll_window(start: i64, amount: u64, now: i64, window_seconds: i64) -> Result<(i64, u64)> {
    let end = start
        .checked_add(window_seconds)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    if now >= end {
        Ok((now, 0))
    } else {
        Ok((start, amount))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const USDC: u64 = 1_000_000;

    #[test]
    fn first_deposit_gets_virtual_rate() {
        let shares = shares_for_deposit(100 * USDC, 0, 0).unwrap();
        assert_eq!(shares, 100 * USDC * 1_000);
        assert_eq!(assets_for_shares(shares, 100 * USDC, shares).unwrap(), 100 * USDC);
    }

    #[test]
    fn round_trip_never_pays_more_than_deposited() {
        let (mut total_assets, mut total_shares) = (0u64, 0u64);
        for amount in [1u64, 7, 999_999, 12_345_678, 10_000 * USDC] {
            let shares = shares_for_deposit(amount, total_assets, total_shares).unwrap();
            total_assets += amount;
            total_shares += shares;
            let back = assets_for_shares(shares, total_assets, total_shares).unwrap();
            assert!(back <= amount, "paid {back} for deposit {amount}");
        }
    }

    #[test]
    fn yield_accrues_to_existing_shares() {
        let shares = shares_for_deposit(1_000 * USDC, 0, 0).unwrap();
        // Vault earns 5%.
        let assets = assets_for_shares(shares, 1_050 * USDC, shares).unwrap();
        assert!(assets >= 1_049_999_000 && assets <= 1_050 * USDC);
    }

    #[test]
    fn donation_attack_is_unprofitable() {
        // Attacker deposits 1 base unit, then donates 10,000 USDC to the reserve.
        let attacker_shares = shares_for_deposit(1, 0, 0).unwrap();
        let total_assets = 1 + 10_000 * USDC;
        // Victim deposits 1,000 USDC and still receives shares.
        let victim_shares = shares_for_deposit(1_000 * USDC, total_assets, attacker_shares).unwrap();
        assert!(victim_shares > 0);
        let total_shares = attacker_shares + victim_shares;
        let total_assets = total_assets + 1_000 * USDC;
        let attacker_out = assets_for_shares(attacker_shares, total_assets, total_shares).unwrap();
        // The attacker cannot recover their donation.
        assert!(attacker_out < 10_000 * USDC);
    }

    #[test]
    fn overflow_is_an_error_not_a_wrap() {
        assert!(mul_div_floor(u128::MAX, 2, 1).is_err());
        assert!(shares_for_deposit(u64::MAX, 0, u64::MAX).is_err());
    }

    #[test]
    fn window_rolls_over() {
        // A fresh account (start 0) on a real clock starts a new window.
        assert_eq!(roll_window(0, 0, 1_700_000_000, 3_600).unwrap(), (1_700_000_000, 0));
        // A clock at 0 keeps counting within the window instead of resetting.
        assert_eq!(roll_window(0, 50, 0, 3_600).unwrap(), (0, 50));
        assert_eq!(roll_window(1_000, 50, 2_000, 3_600).unwrap(), (1_000, 50));
        assert_eq!(roll_window(1_000, 50, 4_600, 3_600).unwrap(), (4_600, 0));
    }
}
