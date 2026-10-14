use crate::constants::*;
use crate::error::VaultError;
use crate::state::StrategyConfig;
use anchor_lang::prelude::*;

/// Configurable safety limits. All amounts are in token base units.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct VaultLimits {
    /// Maximum total assets the vault accepts.
    pub deposit_cap: u64,
    /// Smallest accepted deposit.
    pub min_deposit: u64,
    /// Most a single position can withdraw instantly per window. Anything
    /// larger goes through `request_withdrawal` and the timelock.
    pub large_withdrawal_threshold: u64,
    /// Waiting period for timelocked withdrawals.
    pub withdrawal_timelock_seconds: i64,
    /// Length of the rolling window for instant-withdrawal limits.
    pub window_seconds: i64,
    /// Circuit breaker: total instant withdrawals across all users per window.
    pub vault_instant_outflow_cap: u64,
}

impl VaultLimits {
    pub fn validate(&self) -> Result<()> {
        require!(self.deposit_cap > 0, VaultError::InvalidLimits);
        require!(self.min_deposit > 0, VaultError::InvalidLimits);
        require!(self.large_withdrawal_threshold > 0, VaultError::InvalidLimits);
        require!(
            self.vault_instant_outflow_cap >= self.large_withdrawal_threshold,
            VaultError::InvalidLimits
        );
        require!(
            (MIN_TIMELOCK_SECONDS..=MAX_TIMELOCK_SECONDS).contains(&self.withdrawal_timelock_seconds),
            VaultError::InvalidLimits
        );
        require!(
            (MIN_WINDOW_SECONDS..=MAX_WINDOW_SECONDS).contains(&self.window_seconds),
            VaultError::InvalidLimits
        );
        Ok(())
    }
}

/// One vault per (mint, risk profile).
/// PDA: ["vault", mint, risk_profile]
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub version: u8,
    pub bump: u8,
    pub reserve_bump: u8,
    /// 0 = play it safe, 1 = balanced, 2 = go bigger.
    pub risk_profile: u8,
    pub paused: bool,
    /// Can change limits, strategy and roles, and unpause.
    pub authority: Pubkey,
    /// Proposed new authority; must call `accept_authority`. Default = none.
    pub pending_authority: Pubkey,
    /// Can pause (not unpause) in an emergency.
    pub guardian: Pubkey,
    pub mint: Pubkey,
    /// Token account holding liquid funds. PDA: ["reserve", vault]
    pub reserve: Pubkey,
    /// All outstanding shares, including shares locked in pending withdrawals.
    pub total_shares: u64,
    /// Shares locked in pending withdrawal requests.
    pub pending_withdrawal_shares: u64,
    /// Assets the vault has moved out of the reserve into practice pools.
    pub deployed_assets: u64,
    pub cumulative_deposits: u64,
    pub cumulative_withdrawals: u64,
    pub limits: VaultLimits,
    pub strategy: StrategyConfig,
    /// Rolling instant-outflow window (vault-wide circuit breaker).
    pub window_start_ts: i64,
    pub window_outflow: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Vault {
    pub fn total_assets(&self, reserve_amount: u64) -> Result<u64> {
        reserve_amount
            .checked_add(self.deployed_assets)
            .ok_or_else(|| error!(VaultError::MathOverflow))
    }

    pub fn is_admin(&self, key: &Pubkey) -> bool {
        &self.authority == key
    }

    pub fn can_pause(&self, key: &Pubkey) -> bool {
        &self.authority == key || &self.guardian == key
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limits() -> VaultLimits {
        VaultLimits {
            deposit_cap: 1_000_000_000_000,
            min_deposit: 1_000_000,
            large_withdrawal_threshold: 2_000_000_000,
            withdrawal_timelock_seconds: 30 * 60,
            window_seconds: 24 * 60 * 60,
            vault_instant_outflow_cap: 50_000_000_000,
        }
    }

    #[test]
    fn valid_limits_pass() {
        limits().validate().unwrap();
    }

    #[test]
    fn invalid_limits_fail() {
        let mut l = limits();
        l.withdrawal_timelock_seconds = 0;
        assert!(l.validate().is_err());

        let mut l = limits();
        l.vault_instant_outflow_cap = l.large_withdrawal_threshold - 1;
        assert!(l.validate().is_err());

        let mut l = limits();
        l.window_seconds = MAX_WINDOW_SECONDS + 1;
        assert!(l.validate().is_err());

        let mut l = limits();
        l.min_deposit = 0;
        assert!(l.validate().is_err());
    }
}
