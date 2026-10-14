use crate::state::{Allocation, Protocol, VaultLimits};
use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub mint: Pubkey,
    pub risk_profile: u8,
    pub authority: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
    pub total_assets: u64,
    pub total_shares: u64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct WithdrawalRequested {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    /// Value at request time. The final amount is priced when executed.
    pub estimated_assets: u64,
    pub unlock_ts: i64,
}

#[event]
pub struct WithdrawalExecuted {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub assets: u64,
}

#[event]
pub struct WithdrawalCancelled {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
}

#[event]
pub struct StrategyUpdated {
    pub vault: Pubkey,
    pub version: u32,
    pub allocations: Vec<Allocation>,
}

#[event]
pub struct LimitsUpdated {
    pub vault: Pubkey,
    pub limits: VaultLimits,
}

#[event]
pub struct PauseChanged {
    pub vault: Pubkey,
    pub paused: bool,
    pub by: Pubkey,
}

#[event]
pub struct GuardianChanged {
    pub vault: Pubkey,
    pub guardian: Pubkey,
}

#[event]
pub struct AuthorityTransferStarted {
    pub vault: Pubkey,
    pub pending_authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub vault: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct PracticePoolOpened {
    pub vault: Pubkey,
    pub pool: Pubkey,
    pub protocol: Protocol,
    pub apy_bps: u16,
}

#[event]
pub struct Rebalanced {
    pub vault: Pubkey,
    pub protocol: Protocol,
    /// Moved from the reserve into the pool.
    pub to_pool: u64,
    /// Moved from the pool back to the reserve.
    pub to_reserve: u64,
    pub pool_deployed: u64,
    pub reserve_after: u64,
}

#[event]
pub struct PracticeYieldAccrued {
    pub vault: Pubkey,
    pub protocol: Protocol,
    pub interest: u64,
    pub pool_deployed: u64,
}

#[event]
pub struct PoolLiquidityPulled {
    pub vault: Pubkey,
    pub protocol: Protocol,
    pub amount: u64,
}
