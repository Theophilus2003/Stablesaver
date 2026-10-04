//! StableSave Vault
//!
//! A share-based savings vault for USDC (or another 6-decimal stablecoin).
//! One vault exists per (mint, risk profile). Depositors receive shares;
//! withdrawals redeem shares at the current exchange rate.
//!
//! Safety controls, all enforced here rather than in the frontend:
//! - Vault creation restricted to the program upgrade authority.
//! - Mint, reserve and token-account validation on every instruction.
//! - Checked arithmetic everywhere; rounding favours the vault.
//! - Virtual shares/assets to neutralise share-price inflation attacks.
//! - Instant withdrawals capped per position and per vault in a rolling window.
//! - Larger withdrawals go through a timelocked request.
//! - Emergency pause (authority or guardian); only the authority can unpause.
//! - Strategy weights validated on-chain (≤ 8 protocols, unique, sum to 100%).
//! - Two-step authority transfer.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FNeatGcWmVKVZq5BuXMQ2aaoAxjbfms6GzenerUHxWBj");

#[program]
pub mod stablesave_vault {
    use super::*;

    /// Create the vault and its reserve for `mint` and `risk_profile` (0–2).
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        risk_profile: u8,
        params: InitializeVaultParams,
    ) -> Result<()> {
        instructions::initialize_vault::handle_initialize_vault(ctx, risk_profile, params)
    }

    /// Deposit `amount` base units; mints at least `min_shares_out` shares.
    pub fn deposit(ctx: Context<Deposit>, amount: u64, min_shares_out: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount, min_shares_out)
    }

    /// Instant withdrawal within the position's and vault's window limits.
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64, min_assets_out: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, shares, min_assets_out)
    }

    /// Lock `shares` for a timelocked (large) withdrawal.
    pub fn request_withdrawal(ctx: Context<ManageWithdrawalRequest>, shares: u64) -> Result<()> {
        instructions::request_withdrawal::handle_request_withdrawal(ctx, shares)
    }

    /// Pay out a pending request after its timelock.
    pub fn execute_withdrawal(ctx: Context<Withdraw>, min_assets_out: u64) -> Result<()> {
        instructions::withdraw::handle_execute_withdrawal(ctx, min_assets_out)
    }

    /// Return pending shares to the position.
    pub fn cancel_withdrawal(ctx: Context<ManageWithdrawalRequest>) -> Result<()> {
        instructions::request_withdrawal::handle_cancel_withdrawal(ctx)
    }

    pub fn update_strategy(ctx: Context<AdminUpdate>, allocations: Vec<Allocation>) -> Result<()> {
        instructions::admin::handle_update_strategy(ctx, allocations)
    }

    pub fn update_limits(ctx: Context<AdminUpdate>, limits: VaultLimits) -> Result<()> {
        instructions::admin::handle_update_limits(ctx, limits)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::admin::handle_pause(ctx)
    }

    pub fn unpause(ctx: Context<AdminUpdate>) -> Result<()> {
        instructions::admin::handle_unpause(ctx)
    }

    pub fn set_guardian(ctx: Context<AdminUpdate>, guardian: Pubkey) -> Result<()> {
        instructions::admin::handle_set_guardian(ctx, guardian)
    }

    pub fn transfer_authority(ctx: Context<AdminUpdate>, new_authority: Pubkey) -> Result<()> {
        instructions::admin::handle_transfer_authority(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::admin::handle_accept_authority(ctx)
    }
}
