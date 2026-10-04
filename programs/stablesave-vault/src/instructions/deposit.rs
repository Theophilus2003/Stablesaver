use crate::constants::*;
use crate::error::VaultError;
use crate::events::Deposited;
use crate::math;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = mint @ VaultError::UnsupportedMint,
        has_one = reserve @ VaultError::InvalidTokenAccount,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [POSITION_SEED, vault.key().as_ref(), owner.key().as_ref()],
        bump,
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
    pub system_program: Program<'info, System>,
}

/// Deposit `amount` base units and receive vault shares.
/// `min_shares_out` protects against the share price moving before landing.
pub fn handle_deposit(ctx: Context<Deposit>, amount: u64, min_shares_out: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;
    require!(!vault.paused, VaultError::VaultPaused);
    require!(amount > 0, VaultError::ZeroAmount);
    require!(amount >= vault.limits.min_deposit, VaultError::BelowMinimumDeposit);

    let total_assets = vault.total_assets(ctx.accounts.reserve.amount)?;
    let assets_after = total_assets
        .checked_add(amount)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    require!(assets_after <= vault.limits.deposit_cap, VaultError::DepositCapExceeded);

    let shares = math::shares_for_deposit(amount, total_assets, vault.total_shares)?;
    require!(shares > 0, VaultError::ZeroShares);
    require!(shares >= min_shares_out, VaultError::SlippageExceeded);

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.reserve.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let vault_key = ctx.accounts.vault.key();
    let owner_key = ctx.accounts.owner.key();

    let position = &mut ctx.accounts.position;
    if position.owner == Pubkey::default() {
        // Fresh account from init_if_needed.
        position.version = ACCOUNT_VERSION;
        position.bump = ctx.bumps.position;
        position.vault = vault_key;
        position.owner = owner_key;
        position.created_at = now;
    }
    require_keys_eq!(position.owner, owner_key, VaultError::Unauthorized);
    require_keys_eq!(position.vault, vault_key, VaultError::Unauthorized);

    position.shares = position
        .shares
        .checked_add(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.total_deposited = position
        .total_deposited
        .checked_add(amount)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    position.updated_at = now;

    let vault = &mut ctx.accounts.vault;
    vault.total_shares = vault
        .total_shares
        .checked_add(shares)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.cumulative_deposits = vault
        .cumulative_deposits
        .checked_add(amount)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    emit!(Deposited {
        vault: vault_key,
        owner: owner_key,
        assets: amount,
        shares,
        total_assets: assets_after,
        total_shares: vault.total_shares,
    });
    Ok(())
}
