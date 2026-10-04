use crate::constants::*;
use crate::error::VaultError;
use crate::events::{WithdrawalExecuted, Withdrawn};
use crate::math;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

/// Accounts shared by `withdraw` and `execute_withdrawal`.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = mint @ VaultError::UnsupportedMint,
        has_one = reserve @ VaultError::InvalidTokenAccount,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [POSITION_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ VaultError::Unauthorized,
        has_one = vault @ VaultError::Unauthorized,
    )]
    pub position: Account<'info, UserPosition>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reserve: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Withdraw<'info> {
    fn pay_out(&self, assets: u64) -> Result<()> {
        require!(assets <= self.reserve.amount, VaultError::InsufficientLiquidity);
        let mint = self.vault.mint;
        let risk_profile = [self.vault.risk_profile];
        let bump = [self.vault.bump];
        let seeds: &[&[u8]] = &[VAULT_SEED, mint.as_ref(), &risk_profile, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from: self.reserve.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.owner_token.to_account_info(),
                    authority: self.vault.to_account_info(),
                },
                &[seeds],
            ),
            assets,
            self.mint.decimals,
        )
    }
}

/// Instant withdrawal of `shares`, limited per position and per vault within
/// the rolling window. Larger amounts must use `request_withdrawal`.
pub fn handle_withdraw(ctx: Context<Withdraw>, shares: u64, min_assets_out: u64) -> Result<()> {
    let accounts = &ctx.accounts;
    require!(!accounts.vault.paused, VaultError::VaultPaused);
    require!(shares > 0, VaultError::ZeroAmount);
    require!(shares <= accounts.position.shares, VaultError::InsufficientShares);

    let now = Clock::get()?.unix_timestamp;
    let total_assets = accounts.vault.total_assets(accounts.reserve.amount)?;
    let assets = math::assets_for_shares(shares, total_assets, accounts.vault.total_shares)?;
    require!(assets > 0, VaultError::ZeroAmount);
    require!(assets >= min_assets_out, VaultError::SlippageExceeded);

    let limits = accounts.vault.limits;

    // Per-position instant allowance.
    let (user_start, user_used) = math::roll_window(
        accounts.position.window_start_ts,
        accounts.position.window_withdrawn,
        now,
        limits.window_seconds,
    )?;
    let user_after = user_used
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    require!(
        user_after <= limits.large_withdrawal_threshold,
        VaultError::LargeWithdrawalRequiresTimelock
    );

    // Vault-wide circuit breaker.
    let (vault_start, vault_used) = math::roll_window(
        accounts.vault.window_start_ts,
        accounts.vault.window_outflow,
        now,
        limits.window_seconds,
    )?;
    let vault_after = vault_used
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    require!(
        vault_after <= limits.vault_instant_outflow_cap,
        VaultError::VaultOutflowLimitReached
    );

    accounts.pay_out(assets)?;

    let position = &mut ctx.accounts.position;
    position.shares = position
        .shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.window_start_ts = user_start;
    position.window_withdrawn = user_after;
    position.total_withdrawn = position
        .total_withdrawn
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.updated_at = now;

    let vault = &mut ctx.accounts.vault;
    vault.total_shares = vault
        .total_shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.window_start_ts = vault_start;
    vault.window_outflow = vault_after;
    vault.cumulative_withdrawals = vault
        .cumulative_withdrawals
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    emit!(Withdrawn {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        assets,
        shares,
    });
    Ok(())
}

/// Complete a timelocked withdrawal once `pending_unlock_ts` has passed.
/// Priced at execution, so the position keeps earning (or losing) until then.
pub fn handle_execute_withdrawal(ctx: Context<Withdraw>, min_assets_out: u64) -> Result<()> {
    let accounts = &ctx.accounts;
    require!(!accounts.vault.paused, VaultError::VaultPaused);
    let shares = accounts.position.pending_shares;
    require!(shares > 0, VaultError::NoPendingWithdrawal);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= accounts.position.pending_unlock_ts, VaultError::TimelockActive);

    let total_assets = accounts.vault.total_assets(accounts.reserve.amount)?;
    let assets = math::assets_for_shares(shares, total_assets, accounts.vault.total_shares)?;
    require!(assets > 0, VaultError::ZeroAmount);
    require!(assets >= min_assets_out, VaultError::SlippageExceeded);

    accounts.pay_out(assets)?;

    let position = &mut ctx.accounts.position;
    position.pending_shares = 0;
    position.pending_requested_ts = 0;
    position.pending_unlock_ts = 0;
    position.total_withdrawn = position
        .total_withdrawn
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.updated_at = now;

    let vault = &mut ctx.accounts.vault;
    vault.total_shares = vault
        .total_shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.pending_withdrawal_shares = vault
        .pending_withdrawal_shares
        .checked_sub(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.cumulative_withdrawals = vault
        .cumulative_withdrawals
        .checked_add(assets)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    emit!(WithdrawalExecuted {
        vault: vault.key(),
        owner: ctx.accounts.owner.key(),
        shares,
        assets,
    });
    Ok(())
}
