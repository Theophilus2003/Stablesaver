use crate::constants::*;
use crate::error::VaultError;
use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

/// Moves `amount` between two token accounts the vault PDA owns.
pub fn vault_transfer<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let mint_key = vault.mint;
    let risk_profile = [vault.risk_profile];
    let bump = [vault.bump];
    let seeds: &[&[u8]] = &[VAULT_SEED, mint_key.as_ref(), &risk_profile, &bump];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked { from, mint: mint.to_account_info(), to, authority: vault.to_account_info() },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}

/// Authority-only: open the practice pool for `protocol` with a fixed rate.
/// Also creates the vault's yield-sponsor account the first time.
#[derive(Accounts)]
#[instruction(protocol: Protocol)]
pub struct OpenPracticePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority @ VaultError::Unauthorized,
        has_one = mint @ VaultError::UnsupportedMint,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = authority,
        space = 8 + PracticePool::INIT_SPACE,
        seeds = [POOL_SEED, vault.key().as_ref(), &[protocol.index()]],
        bump,
    )]
    pub pool: Account<'info, PracticePool>,

    #[account(
        init,
        payer = authority,
        seeds = [POOL_TOKENS_SEED, pool.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub tokens: Account<'info, TokenAccount>,

    /// Pays the practice interest. Anyone can top it up with a normal transfer.
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [YIELD_SPONSOR_SEED, vault.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub yield_sponsor: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_practice_pool(ctx: Context<OpenPracticePool>, protocol: Protocol, apy_bps: u16) -> Result<()> {
    require!(apy_bps <= MAX_PRACTICE_APY_BPS, VaultError::InvalidPracticeRate);
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    pool.version = ACCOUNT_VERSION;
    pool.bump = ctx.bumps.pool;
    pool.tokens_bump = ctx.bumps.tokens;
    pool.vault = ctx.accounts.vault.key();
    pool.protocol = protocol;
    pool.tokens = ctx.accounts.tokens.key();
    pool.apy_bps = apy_bps;
    pool.deployed = 0;
    pool.interest_paid = 0;
    pool.last_accrual_ts = now;
    pool.created_at = now;
    emit!(PracticePoolOpened { vault: pool.vault, pool: pool.key(), protocol, apy_bps });
    Ok(())
}

/// Permissionless: move one pool toward its strategy weight. It can only move
/// money between the vault's own accounts, toward the on-chain strategy, and
/// never takes the reserve below the liquidity buffer.
#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(
        mut,
        has_one = mint @ VaultError::UnsupportedMint,
        has_one = reserve @ VaultError::InvalidTokenAccount,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        has_one = vault @ VaultError::InvalidPoolAccount,
        has_one = tokens @ VaultError::InvalidPoolAccount,
    )]
    pub pool: Account<'info, PracticePool>,

    #[account(mut)]
    pub tokens: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reserve: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_rebalance(ctx: Context<Rebalance>) -> Result<()> {
    let accounts = &ctx.accounts;
    require!(!accounts.vault.paused, VaultError::VaultPaused);
    let protocol = accounts.pool.protocol;
    let weight_bps = accounts
        .vault
        .strategy
        .allocations
        .iter()
        .find(|a| a.protocol == protocol)
        .map(|a| a.weight_bps)
        .unwrap_or(0);
    let movement = rebalance_move(
        accounts.reserve.amount,
        accounts.vault.deployed_assets,
        accounts.pool.deployed,
        weight_bps,
    )?;

    let (to_pool, to_reserve) = match movement {
        Move::ToPool(amount) => {
            vault_transfer(
                &accounts.token_program,
                &accounts.vault,
                &accounts.mint,
                accounts.reserve.to_account_info(),
                accounts.tokens.to_account_info(),
                amount,
            )?;
            (amount, 0)
        }
        Move::ToReserve(amount) => {
            let amount = amount.min(accounts.tokens.amount);
            vault_transfer(
                &accounts.token_program,
                &accounts.vault,
                &accounts.mint,
                accounts.tokens.to_account_info(),
                accounts.reserve.to_account_info(),
                amount,
            )?;
            (0, amount)
        }
        Move::None => return Ok(()),
    };

    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    // A pool that was empty starts earning from now, not from when it was opened.
    if pool.deployed == 0 {
        pool.last_accrual_ts = now;
    }
    pool.deployed = pool
        .deployed
        .checked_add(to_pool)
        .and_then(|v| v.checked_sub(to_reserve))
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    let pool_deployed = pool.deployed;

    let vault = &mut ctx.accounts.vault;
    vault.deployed_assets = vault
        .deployed_assets
        .checked_add(to_pool)
        .and_then(|v| v.checked_sub(to_reserve))
        .ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    ctx.accounts.reserve.reload()?;
    emit!(Rebalanced {
        vault: ctx.accounts.vault.key(),
        protocol,
        to_pool,
        to_reserve,
        pool_deployed,
        reserve_after: ctx.accounts.reserve.amount,
    });
    Ok(())
}

/// Permissionless: pay one pool the interest it has earned since the last
/// accrual, from the yield-sponsor account (capped by what the sponsor holds).
#[derive(Accounts)]
pub struct AccruePracticeYield<'info> {
    #[account(mut, has_one = mint @ VaultError::UnsupportedMint)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        has_one = vault @ VaultError::InvalidPoolAccount,
        has_one = tokens @ VaultError::InvalidPoolAccount,
    )]
    pub pool: Account<'info, PracticePool>,

    #[account(mut)]
    pub tokens: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [YIELD_SPONSOR_SEED, vault.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub yield_sponsor: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_accrue_practice_yield(ctx: Context<AccruePracticeYield>) -> Result<()> {
    let accounts = &ctx.accounts;
    require!(!accounts.vault.paused, VaultError::VaultPaused);
    let now = Clock::get()?.unix_timestamp;
    let owed = accrued_interest(accounts.pool.deployed, accounts.pool.apy_bps, now - accounts.pool.last_accrual_ts)?;
    let interest = owed.min(accounts.yield_sponsor.amount);
    if interest > 0 {
        vault_transfer(
            &accounts.token_program,
            &accounts.vault,
            &accounts.mint,
            accounts.yield_sponsor.to_account_info(),
            accounts.tokens.to_account_info(),
            interest,
        )?;
    }

    let pool = &mut ctx.accounts.pool;
    pool.last_accrual_ts = now;
    pool.deployed = pool.deployed.checked_add(interest).ok_or_else(|| error!(VaultError::MathOverflow))?;
    pool.interest_paid = pool.interest_paid.checked_add(interest).ok_or_else(|| error!(VaultError::MathOverflow))?;
    let (protocol, pool_deployed) = (pool.protocol, pool.deployed);

    let vault = &mut ctx.accounts.vault;
    vault.deployed_assets = vault.deployed_assets.checked_add(interest).ok_or_else(|| error!(VaultError::MathOverflow))?;
    vault.updated_at = now;

    if interest > 0 {
        emit!(PracticeYieldAccrued { vault: vault.key(), protocol, interest, pool_deployed });
    }
    Ok(())
}
