use crate::constants::*;
use crate::error::VaultError;
use crate::events::{WithdrawalCancelled, WithdrawalRequested};
use crate::math;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct ManageWithdrawalRequest<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = reserve @ VaultError::InvalidTokenAccount)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [POSITION_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ VaultError::Unauthorized,
        has_one = vault @ VaultError::Unauthorized,
    )]
    pub position: Account<'info, UserPosition>,

    pub reserve: Account<'info, TokenAccount>,
}

/// Lock `shares` for a timelocked withdrawal. Allowed while paused (no funds
/// move); `execute_withdrawal` stays blocked until the vault is unpaused.
pub fn handle_request_withdrawal(ctx: Context<ManageWithdrawalRequest>, shares: u64) -> Result<()> {
    require!(shares > 0, VaultError::ZeroAmount);
    require!(
        !ctx.accounts.position.has_pending_withdrawal(),
        VaultError::WithdrawalAlreadyPending
    );
    require!(shares <= ctx.accounts.position.shares, VaultError::InsufficientShares);

    let now = Clock::get()?.unix_timestamp;
    let vault = &ctx.accounts.vault;
    let total_assets = vault.total_assets(ctx.accounts.reserve.amount)?;
    let estimated_assets = math::assets_for_shares(shares, total_assets, vault.total_shares)?;
    let unlock_ts = now
        .checked_add(vault.limits.withdrawal_timelock_seconds)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;

    let position = &mut ctx.accounts.position;
    position.shares = position
        .shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.pending_shares = shares;
    position.pending_requested_ts = now;
    position.pending_unlock_ts = unlock_ts;
    position.updated_at = now;

    let vault = &mut ctx.accounts.vault;
    vault.pending_withdrawal_shares = vault
        .pending_withdrawal_shares
        .checked_add(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    emit!(WithdrawalRequested {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        shares,
        estimated_assets,
        unlock_ts,
    });
    Ok(())
}

/// Return pending shares to the position.
pub fn handle_cancel_withdrawal(ctx: Context<ManageWithdrawalRequest>) -> Result<()> {
    let shares = ctx.accounts.position.pending_shares;
    require!(shares > 0, VaultError::NoPendingWithdrawal);
    let now = Clock::get()?.unix_timestamp;

    let position = &mut ctx.accounts.position;
    position.shares = position
        .shares
        .checked_add(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.pending_shares = 0;
    position.pending_requested_ts = 0;
    position.pending_unlock_ts = 0;
    position.updated_at = now;

    let vault = &mut ctx.accounts.vault;
    vault.pending_withdrawal_shares = vault
        .pending_withdrawal_shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    emit!(WithdrawalCancelled {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        shares,
    });
    Ok(())
}
