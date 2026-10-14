use crate::constants::{BPS_DENOMINATOR, MAX_ALLOCATIONS_USIZE};
use crate::error::VaultError;
use anchor_lang::prelude::*;

/// Protocols a strategy can allocate to. Mirrors `ONCHAIN_PROTOCOL_IDS` in
/// `@stablesave/core`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Protocol {
    Kamino,
    Marginfi,
    Drift,
    Save,
}

impl Protocol {
    /// Seed byte for per-protocol accounts (practice pools).
    pub fn index(&self) -> u8 {
        *self as u8
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct Allocation {
    pub protocol: Protocol,
    /// Target share of vault assets, in basis points.
    pub weight_bps: u16,
}

/// Target allocation for the vault. `rebalance` moves funds between the reserve
/// and each protocol's practice pool toward these weights; CPI into the real
/// protocols will read the same configuration in a later release.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub struct StrategyConfig {
    /// Incremented on every update so clients can detect changes.
    pub version: u32,
    #[max_len(8)]
    pub allocations: Vec<Allocation>,
}

/// Rules enforced by `initialize_vault` and `update_strategy`.
pub fn validate_allocations(allocations: &[Allocation]) -> Result<()> {
    require!(
        !allocations.is_empty() && allocations.len() <= MAX_ALLOCATIONS_USIZE,
        VaultError::InvalidAllocationCount
    );
    let mut total: u32 = 0;
    for (i, allocation) in allocations.iter().enumerate() {
        require!(allocation.weight_bps > 0, VaultError::InvalidAllocationWeight);
        require!(
            !allocations[..i].iter().any(|a| a.protocol == allocation.protocol),
            VaultError::DuplicateProtocol
        );
        total = total
            .checked_add(allocation.weight_bps as u32)
            .ok_or_else(|| error!(VaultError::MathOverflow))?;
    }
    require!(
        total == BPS_DENOMINATOR as u32,
        VaultError::AllocationsMustSumToOneHundredPercent
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn a(protocol: Protocol, weight_bps: u16) -> Allocation {
        Allocation { protocol, weight_bps }
    }

    #[test]
    fn accepts_valid_strategies() {
        validate_allocations(&[a(Protocol::Kamino, 6_000), a(Protocol::Save, 4_000)]).unwrap();
        validate_allocations(&[a(Protocol::Kamino, 10_000)]).unwrap();
    }

    #[test]
    fn rejects_bad_sums_duplicates_and_zero_weights() {
        assert!(validate_allocations(&[]).is_err());
        assert!(validate_allocations(&[a(Protocol::Kamino, 9_999)]).is_err());
        assert!(validate_allocations(&[a(Protocol::Kamino, 5_000), a(Protocol::Kamino, 5_000)]).is_err());
        assert!(validate_allocations(&[a(Protocol::Kamino, 10_000), a(Protocol::Save, 0)]).is_err());
    }
}
