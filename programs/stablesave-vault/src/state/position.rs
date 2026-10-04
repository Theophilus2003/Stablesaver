use anchor_lang::prelude::*;

/// A depositor's stake in one vault.
/// PDA: ["position", vault, owner]
#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub version: u8,
    pub bump: u8,
    pub vault: Pubkey,
    pub owner: Pubkey,
    /// Shares available to withdraw (excludes pending).
    pub shares: u64,
    /// Shares locked in a timelocked withdrawal request.
    pub pending_shares: u64,
    pub pending_requested_ts: i64,
    /// When the pending request can be executed.
    pub pending_unlock_ts: i64,
    /// Lifetime totals, used to show earnings.
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    /// Rolling instant-withdrawal window for this position.
    pub window_start_ts: i64,
    pub window_withdrawn: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl UserPosition {
    pub fn has_pending_withdrawal(&self) -> bool {
        self.pending_shares > 0
    }
}
