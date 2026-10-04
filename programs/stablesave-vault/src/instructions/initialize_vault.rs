use crate::constants::*;
use crate::error::VaultError;
use crate::events::VaultInitialized;
use crate::program::StablesaveVault;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeVaultParams {
    pub guardian: Pubkey,
    pub limits: VaultLimits,
    pub allocations: Vec<Allocation>,
}

#[derive(Accounts)]
#[instruction(risk_profile: u8)]
pub struct InitializeVault<'info> {
    /// Must be the program's upgrade authority, so nobody can front-run vault
    /// creation and install themselves as admin.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(constraint = mint.decimals == REQUIRED_MINT_DECIMALS @ VaultError::UnsupportedMint)]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, mint.key().as_ref(), &[risk_profile]],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = authority,
        seeds = [RESERVE_SEED, vault.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub reserve: Account<'info, TokenAccount>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ VaultError::Unauthorized)]
    pub program: Program<'info, StablesaveVault>,

    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ VaultError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_vault(
    ctx: Context<InitializeVault>,
    risk_profile: u8,
    params: InitializeVaultParams,
) -> Result<()> {
    require!(risk_profile < RISK_PROFILE_COUNT, VaultError::InvalidRiskProfile);
    params.limits.validate()?;
    validate_allocations(&params.allocations)?;

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    vault.version = ACCOUNT_VERSION;
    vault.bump = ctx.bumps.vault;
    vault.reserve_bump = ctx.bumps.reserve;
    vault.risk_profile = risk_profile;
    vault.paused = false;
    vault.authority = ctx.accounts.authority.key();
    vault.pending_authority = Pubkey::default();
    vault.guardian = params.guardian;
    vault.mint = ctx.accounts.mint.key();
    vault.reserve = ctx.accounts.reserve.key();
    vault.total_shares = 0;
    vault.pending_withdrawal_shares = 0;
    vault.deployed_assets = 0;
    vault.cumulative_deposits = 0;
    vault.cumulative_withdrawals = 0;
    vault.limits = params.limits;
    vault.strategy = StrategyConfig {
        version: 1,
        allocations: params.allocations,
    };
    vault.window_start_ts = 0;
    vault.window_outflow = 0;
    vault.created_at = now;
    vault.updated_at = now;

    emit!(VaultInitialized {
        vault: vault.key(),
        mint: vault.mint,
        risk_profile,
        authority: vault.authority,
        guardian: vault.guardian,
    });
    Ok(())
}
