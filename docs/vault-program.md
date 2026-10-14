<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../apps/web/public/brand/stablesave-logo-dark.svg">
  <img src="../apps/web/public/brand/stablesave-logo-light.svg" alt="StableSave" width="180">
</picture>

# StableSave Vault program

`programs/stablesave-vault` (Anchor 1.2). A share-based savings vault for a 6-decimal stablecoin (USDC). One vault
per **(mint, risk profile)**. Depositors receive shares; withdrawals redeem shares at the current exchange rate.

Program ID (dev keypair): `FNeatGcWmVKVZq5BuXMQ2aaoAxjbfms6GzenerUHxWBj`. Run `anchor keys sync` with your own
deploy keypair before deploying.

## Accounts and PDAs

| Account | Seeds | Purpose |
| --- | --- | --- |
| `Vault` | `["vault", mint, risk_profile]` | Config, roles, limits, strategy, share accounting |
| Reserve (SPL token account) | `["reserve", vault]` | Holds liquid funds; authority = vault PDA |
| `UserPosition` | `["position", vault, owner]` | Shares, pending withdrawal, lifetime totals, rolling window |
| `PracticePool` | `["pool", vault, protocol index]` | One per protocol: fixed practice rate, `deployed`, `interest_paid`, last accrual |
| Pool tokens (SPL token account) | `["pool_tokens", pool]` | Holds the pool's funds; authority = vault PDA |
| Yield sponsor (SPL token account) | `["yield_sponsor", vault]` | Pays practice interest; anyone can top it up |

`Vault` fields: `authority`, `pending_authority`, `guardian`, `mint`, `reserve`, `paused`, `total_shares`,
`pending_withdrawal_shares`, `deployed_assets` (held in practice pools), cumulative deposit/withdrawal totals,
`limits: VaultLimits`, `strategy: StrategyConfig { version, allocations: Vec<Allocation> }`, rolling outflow window.

## Instructions

| Instruction | Who | Rules enforced on-chain |
| --- | --- | --- |
| `initialize_vault(risk_profile, params)` | Program upgrade authority | Upgrade-authority check via `ProgramData` (no front-running vault creation); mint must have 6 decimals; limits and allocations validated |
| `deposit(amount, min_shares_out)` | Anyone | Not paused; `amount ≥ min_deposit`; deposit cap; shares > 0; slippage guard; mint/reserve/token-account constraints |
| `withdraw(shares, min_assets_out)` | Position owner | Not paused; per-position instant allowance per window (`large_withdrawal_threshold`); vault-wide instant outflow cap per window; liquidity (reserve, plus any practice pools passed as remaining accounts); slippage guard |
| `request_withdrawal(shares)` | Position owner | One pending request; locks shares; `unlock_ts = now + timelock`. Allowed while paused (no funds move) |
| `execute_withdrawal(min_assets_out)` | Position owner | Not paused; `now ≥ unlock_ts`; priced at execution; pulls any shortfall from practice pools passed as remaining accounts; slippage guard |
| `cancel_withdrawal()` | Position owner | Returns locked shares |
| `open_practice_pool(protocol, apy_bps)` | Authority | Rate ≤ 3,000 bps; creates the pool, its token account and (once) the yield sponsor |
| `rebalance()` | Anyone | Not paused; moves one pool toward `weight × 80%` of total assets; never takes the reserve below the 20% buffer; only moves money between the vault's own accounts |
| `accrue_practice_yield()` | Anyone | Not paused; pays `deployed × rate × elapsed` (simple, rounded down) from the yield sponsor, capped by what it holds |
| `update_strategy(allocations)` | Authority | 1–8 allocations, unique protocols, positive weights, sum = 10,000 bps; bumps `strategy.version` |
| `update_limits(limits)` | Authority | Timelock 60 s – 7 days; window 1 h – 7 days; vault cap ≥ per-position threshold; non-zero caps |
| `pause()` | Authority or guardian | Blocks deposit, withdraw, execute |
| `unpause()` | Authority only | A guardian can stop the vault, not restart it |
| `set_guardian`, `transfer_authority`, `accept_authority` | Authority / pending authority | Two-step authority handover |

## Accounting

- `total_assets = reserve.amount + deployed_assets`.
- `shares = floor(assets × (total_shares + 1,000) / (total_assets + 1))` and the inverse for redemption. The virtual
  offset neutralises first-depositor share-inflation (donation) attacks; both directions round in the vault's favour.
- All arithmetic is checked (`u128` intermediates, explicit `MathOverflow` errors); `overflow-checks = true` in
  release.
- Pending shares stay in `total_shares` until executed, so they keep earning (or losing) during the timelock.

## Events

`VaultInitialized`, `Deposited`, `Withdrawn`, `WithdrawalRequested`, `WithdrawalExecuted`, `WithdrawalCancelled`,
`StrategyUpdated`, `LimitsUpdated`, `PauseChanged`, `GuardianChanged`, `AuthorityTransferStarted`,
`AuthorityTransferred`, `PracticePoolOpened`, `Rebalanced`, `PracticeYieldAccrued`, `PoolLiquidityPulled`.

## Practice pools

`total_assets = reserve + deployed_assets`, and `deployed_assets` always equals the sum of the pools' `deployed`:
every unit is a real token in a vault-owned account. `rebalance` targets `weight × (total − 20%)` per pool and
leaves 20% in the reserve, so most withdrawals pay straight from it; when one doesn't fit, `withdraw` and
`execute_withdrawal` pull the shortfall from the pools passed as remaining accounts (fullest first, each checked to
belong to this vault). Interest is real too: it comes out of the yield sponsor, so share prices only rise by what
was actually paid in. Pausing stops rebalancing and accrual along with deposits and withdrawals.

## Build, test, deploy

```bash
# Host tests (math, validation) + LiteSVM integration tests
cargo test -p stablesave-vault

# SBF build (needs Anchor CLI + Solana platform tools); integration tests then run for real
anchor build
cargo test -p stablesave-vault

# IDL + client
pnpm idl:build && pnpm generate:client

# Devnet: build for your key's program id, deploy, create a test token, send some to a wallet, open the vaults
STABLESAVE_DEPLOYER_KEY="$(cat ~/.config/solana/id.json)" \
  scripts/deploy-vault.sh https://api.devnet.solana.com --to <wallet>
```

Or run the **Vault program** workflow in GitHub Actions; see [devnet-testing.md](devnet-testing.md). On every
change to the program or client, the same workflow builds the program, runs these tests for real and rehearses
the whole deploy (including a deposit and withdrawal) on a local validator.

The LiteSVM tests in `tests/vault.rs` load `target/deploy/stablesave_vault.so`; without it they print a notice and
skip. They cover upgrade-authority gating, deposit + instant withdrawal limits, the timelock path, guardian pause vs
authority unpause, on-chain strategy validation, and practice pools: only the authority opens them, rebalance splits
by strategy and keeps the buffer, interest comes from the sponsor, withdrawals pull from pools when the reserve is
short, and pausing stops rebalancing.

Then set `NEXT_PUBLIC_STABLESAVE_VAULT_PROGRAM_ID` and `NEXT_PUBLIC_STABLESAVE_VAULT_MINT` for the web app.

## Not done yet

- **Real protocols**: CPI into Kamino / MarginFi / Drift / Save in place of the practice pools, using the same
  `strategy.allocations`, `rebalance` and `deployed_assets` accounting.
- **Fees**: no management or performance fee is charged.
- **Audit**: unaudited. Consider a strategy-change timelock and a multisig authority before mainnet.
