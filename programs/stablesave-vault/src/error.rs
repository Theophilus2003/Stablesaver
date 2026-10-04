use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Signer is not allowed to perform this action")]
    Unauthorized,
    #[msg("The vault is paused")]
    VaultPaused,
    #[msg("The vault is not paused")]
    VaultNotPaused,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Deposit is too small to mint any shares")]
    ZeroShares,
    #[msg("Deposit is below the vault minimum")]
    BelowMinimumDeposit,
    #[msg("Deposit would exceed the vault's deposit cap")]
    DepositCapExceeded,
    #[msg("Result is worse than the minimum you accepted")]
    SlippageExceeded,
    #[msg("Not enough shares in this position")]
    InsufficientShares,
    #[msg("Not enough liquid funds in the vault reserve right now")]
    InsufficientLiquidity,
    #[msg("This withdrawal is above your instant limit; request a timelocked withdrawal instead")]
    LargeWithdrawalRequiresTimelock,
    #[msg("The vault's instant-withdrawal limit for this window has been reached; request a timelocked withdrawal instead")]
    VaultOutflowLimitReached,
    #[msg("A withdrawal request is already pending for this position")]
    WithdrawalAlreadyPending,
    #[msg("There is no pending withdrawal request")]
    NoPendingWithdrawal,
    #[msg("The withdrawal timelock has not expired yet")]
    TimelockActive,
    #[msg("Risk profile must be 0 (safe), 1 (balanced) or 2 (bigger)")]
    InvalidRiskProfile,
    #[msg("A strategy needs between 1 and 8 allocations")]
    InvalidAllocationCount,
    #[msg("Each allocation weight must be greater than zero")]
    InvalidAllocationWeight,
    #[msg("Allocation weights must add up to 10,000 basis points")]
    AllocationsMustSumToOneHundredPercent,
    #[msg("A protocol can only appear once in a strategy")]
    DuplicateProtocol,
    #[msg("Vault limits are outside the allowed bounds")]
    InvalidLimits,
    #[msg("Mint is not supported by this vault")]
    UnsupportedMint,
    #[msg("Token account does not match the vault")]
    InvalidTokenAccount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Signer is not the pending authority")]
    NotPendingAuthority,
}
