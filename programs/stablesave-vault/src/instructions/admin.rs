use crate::error::VaultError;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;

/// Authority-only configuration changes.
#[derive(Accounts)]
pub struct AdminUpdate<'info> {
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority @ VaultError::Unauthorized)]
    pub vault: Account<'info, Vault>,
}

/// Pausing is open to the authority or the guardian.
#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(constraint = vault.can_pause(&signer.key()) @ VaultError::Unauthorized)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        constraint = vault.pending_authority == new_authority.key() @ VaultError::NotPendingAuthority,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handle_update_strategy(ctx: Context<AdminUpdate>, allocations: Vec<Allocation>) -> Result<()> {
    validate_allocations(&allocations)?;
    let vault = &mut ctx.accounts.vault;
    vault.strategy.version = vault
        .strategy
        .version
        .checked_add(1)
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.strategy.allocations = allocations;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(StrategyUpdated {
        vault: vault.key(),
        version: vault.strategy.version,
        allocations: vault.strategy.allocations.clone(),
    });
    Ok(())
}

pub fn handle_update_limits(ctx: Context<AdminUpdate>, limits: VaultLimits) -> Result<()> {
    limits.validate()?;
    let vault = &mut ctx.accounts.vault;
    vault.limits = limits;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(LimitsUpdated {
        vault: vault.key(),
        limits,
    });
    Ok(())
}

pub fn handle_pause(ctx: Context<Pause>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(!vault.paused, VaultError::VaultPaused);
    vault.paused = true;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(PauseChanged {
        vault: vault.key(),
        paused: true,
        by: ctx.accounts.signer.key(),
    });
    Ok(())
}

/// Only the authority can unpause; a guardian can stop the vault but not restart it.
pub fn handle_unpause(ctx: Context<AdminUpdate>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(vault.paused, VaultError::VaultNotPaused);
    vault.paused = false;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(PauseChanged {
        vault: vault.key(),
        paused: false,
        by: ctx.accounts.authority.key(),
    });
    Ok(())
}

pub fn handle_set_guardian(ctx: Context<AdminUpdate>, guardian: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.guardian = guardian;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(GuardianChanged {
        vault: vault.key(),
        guardian,
    });
    Ok(())
}

/// Step 1 of a two-step handover; `Pubkey::default()` cancels.
pub fn handle_transfer_authority(ctx: Context<AdminUpdate>, new_authority: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.pending_authority = new_authority;
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(AuthorityTransferStarted {
        vault: vault.key(),
        pending_authority: new_authority,
    });
    Ok(())
}

pub fn handle_accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.authority = ctx.accounts.new_authority.key();
    vault.pending_authority = Pubkey::default();
    vault.updated_at = Clock::get()?.unix_timestamp;
    emit!(AuthorityTransferred {
        vault: vault.key(),
        authority: vault.authority,
    });
    Ok(())
}
