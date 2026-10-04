//! End-to-end tests against the compiled program in LiteSVM.
//!
//! Requires the SBF build: `anchor build` (or `cargo build-sbf`) writes
//! `target/deploy/stablesave_vault.so`. Without it these tests print a notice
//! and return early, so `cargo test` still works on machines without the
//! Solana toolchain.

use {
    anchor_lang::{
        error::ERROR_CODE_OFFSET,
        prelude::{Clock, Pubkey},
        solana_program::{
            instruction::Instruction,
            program_option::COption,
            program_pack::Pack,
            system_program,
        },
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::token::spl_token::{
        self,
        state::{Account as TokenAccountState, AccountState, Mint as MintState},
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_instruction_error::InstructionError,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    solana_transaction_error::TransactionError,
    stablesave_vault::{
        accounts as ix_accounts, error::VaultError, instruction as ix, Allocation,
        InitializeVaultParams, Protocol, UserPosition, Vault, VaultLimits, POSITION_SEED,
        RESERVE_SEED, VAULT_SEED,
    },
    std::path::PathBuf,
};

const USDC: u64 = 1_000_000;
const BPF_LOADER_UPGRADEABLE: Pubkey = Pubkey::from_str_const("BPFLoaderUpgradeab1e11111111111111111111111");

fn program_so() -> Option<Vec<u8>> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/stablesave_vault.so");
    std::fs::read(&path).ok()
}

macro_rules! require_program {
    () => {
        match program_so() {
            Some(bytes) => bytes,
            None => {
                eprintln!("skipping: target/deploy/stablesave_vault.so not found (run `anchor build`)");
                return;
            }
        }
    };
}

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    guardian: Keypair,
    user: Keypair,
    mint: Pubkey,
    user_token: Pubkey,
    vault: Pubkey,
    reserve: Pubkey,
    position: Pubkey,
    program_data: Pubkey,
}

fn limits() -> VaultLimits {
    VaultLimits {
        deposit_cap: 1_000_000 * USDC,
        min_deposit: USDC,
        large_withdrawal_threshold: 2_000 * USDC,
        withdrawal_timelock_seconds: 30 * 60,
        window_seconds: 24 * 60 * 60,
        vault_instant_outflow_cap: 50_000 * USDC,
    }
}

fn balanced() -> Vec<Allocation> {
    vec![
        Allocation { protocol: Protocol::Kamino, weight_bps: 4_500 },
        Allocation { protocol: Protocol::Marginfi, weight_bps: 3_000 },
        Allocation { protocol: Protocol::Save, weight_bps: 2_500 },
    ]
}

fn set_mint(svm: &mut LiteSVM, address: Pubkey, decimals: u8) {
    let mut data = vec![0u8; MintState::LEN];
    MintState {
        mint_authority: COption::None,
        supply: 1_000_000_000 * USDC,
        decimals,
        is_initialized: true,
        freeze_authority: COption::None,
    }
    .pack_into_slice(&mut data);
    svm.set_account(
        address,
        Account { lamports: 1_000_000_000, data, owner: spl_token::ID, executable: false, rent_epoch: 0 },
    )
    .unwrap();
}

fn set_token_account(svm: &mut LiteSVM, address: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) {
    let mut data = vec![0u8; TokenAccountState::LEN];
    TokenAccountState {
        mint,
        owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    }
    .pack_into_slice(&mut data);
    svm.set_account(
        address,
        Account { lamports: 1_000_000_000, data, owner: spl_token::ID, executable: false, rent_epoch: 0 },
    )
    .unwrap();
}

fn token_amount(svm: &LiteSVM, address: &Pubkey) -> u64 {
    TokenAccountState::unpack(&svm.get_account(address).unwrap().data).unwrap().amount
}

/// LiteSVM deploys with no upgrade authority; set one so `initialize_vault`'s
/// upgrade-authority check can pass for `admin`.
fn set_upgrade_authority(svm: &mut LiteSVM, program_data: Pubkey, authority: Pubkey) {
    let mut account = svm.get_account(&program_data).unwrap();
    // bincode UpgradeableLoaderState::ProgramData { slot: u64, upgrade_authority_address: Option<Pubkey> }
    account.data[12] = 1;
    account.data[13..45].copy_from_slice(authority.as_ref());
    svm.set_account(program_data, account).unwrap();
}

fn send(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> Result<(), InstructionError> {
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    let result = svm.send_transaction(tx);
    svm.expire_blockhash();
    match result {
        Ok(_) => Ok(()),
        Err(failed) => match failed.err {
            TransactionError::InstructionError(_, e) => Err(e),
            other => panic!("unexpected transaction error: {other:?}"),
        },
    }
}

fn assert_vault_error(result: Result<(), InstructionError>, expected: VaultError) {
    let code = ERROR_CODE_OFFSET + expected as u32;
    assert_eq!(result, Err(InstructionError::Custom(code)), "expected {expected:?}");
}

fn setup(bytes: &[u8]) -> Env {
    let program_id = stablesave_vault::id();
    let mut svm = LiteSVM::new();
    svm.add_program(program_id, bytes).unwrap();
    let program_data = Pubkey::find_program_address(&[program_id.as_ref()], &BPF_LOADER_UPGRADEABLE).0;

    let admin = Keypair::new();
    let guardian = Keypair::new();
    let user = Keypair::new();
    for k in [&admin, &guardian, &user] {
        svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
    }
    set_upgrade_authority(&mut svm, program_data, admin.pubkey());

    let mint = Pubkey::new_unique();
    set_mint(&mut svm, mint, 6);
    let user_token = Pubkey::new_unique();
    set_token_account(&mut svm, user_token, mint, user.pubkey(), 10_000 * USDC);

    let vault = Pubkey::find_program_address(&[VAULT_SEED, mint.as_ref(), &[1]], &program_id).0;
    let reserve = Pubkey::find_program_address(&[RESERVE_SEED, vault.as_ref()], &program_id).0;
    let position =
        Pubkey::find_program_address(&[POSITION_SEED, vault.as_ref(), user.pubkey().as_ref()], &program_id).0;

    Env { svm, admin, guardian, user, mint, user_token, vault, reserve, position, program_data }
}

fn initialize_ix(env: &Env, authority: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::InitializeVault {
            risk_profile: 1,
            params: InitializeVaultParams { guardian: env.guardian.pubkey(), limits: limits(), allocations: balanced() },
        }
        .data(),
        ix_accounts::InitializeVault {
            authority,
            mint: env.mint,
            vault: env.vault,
            reserve: env.reserve,
            program: stablesave_vault::id(),
            program_data: env.program_data,
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn deposit_ix(env: &Env, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::Deposit { amount, min_shares_out: 0 }.data(),
        ix_accounts::Deposit {
            owner: env.user.pubkey(),
            vault: env.vault,
            position: env.position,
            mint: env.mint,
            owner_token: env.user_token,
            reserve: env.reserve,
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn withdraw_accounts(env: &Env) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
    ix_accounts::Withdraw {
        owner: env.user.pubkey(),
        vault: env.vault,
        position: env.position,
        mint: env.mint,
        owner_token: env.user_token,
        reserve: env.reserve,
        token_program: spl_token::ID,
    }
    .to_account_metas(None)
}

fn request_accounts(env: &Env) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
    ix_accounts::ManageWithdrawalRequest {
        owner: env.user.pubkey(),
        vault: env.vault,
        position: env.position,
        reserve: env.reserve,
    }
    .to_account_metas(None)
}

fn read<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let account = svm.get_account(address).unwrap();
    T::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn initialized(bytes: &[u8]) -> Env {
    let mut env = setup(bytes);
    let ix = initialize_ix(&env, env.admin.pubkey());
    let admin = env.admin.insecure_clone();
    send(&mut env.svm, &[ix], &admin, &[&admin]).unwrap();
    env
}

#[test]
fn only_upgrade_authority_can_initialize() {
    let bytes = require_program!();
    let mut env = setup(&bytes);
    let impostor = Keypair::new();
    env.svm.airdrop(&impostor.pubkey(), 1_000_000_000).unwrap();
    let ix = initialize_ix(&env, impostor.pubkey());
    assert_vault_error(send(&mut env.svm, &[ix], &impostor, &[&impostor]), VaultError::Unauthorized);

    let ix = initialize_ix(&env, env.admin.pubkey());
    let admin = env.admin.insecure_clone();
    send(&mut env.svm, &[ix], &admin, &[&admin]).unwrap();
    let vault: Vault = read(&env.svm, &env.vault);
    assert_eq!(vault.authority, env.admin.pubkey());
    assert_eq!(vault.strategy.allocations, balanced());
    assert!(!vault.paused);
}

#[test]
fn deposit_and_instant_withdraw_within_limits() {
    let bytes = require_program!();
    let mut env = initialized(&bytes);
    let user = env.user.insecure_clone();

    let deposit = deposit_ix(&env, 5_000 * USDC);

    send(&mut env.svm, &[deposit], &user, &[&user]).unwrap();
    assert_eq!(token_amount(&env.svm, &env.reserve), 5_000 * USDC);
    let position: UserPosition = read(&env.svm, &env.position);
    assert_eq!(position.total_deposited, 5_000 * USDC);

    // 1,000 USDC worth of shares is under the 2,000 USDC instant threshold.
    let shares = position.shares / 5;
    let ix = Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::Withdraw { shares, min_assets_out: 0 }.data(),
        withdraw_accounts(&env),
    );
    send(&mut env.svm, &[ix], &user, &[&user]).unwrap();
    assert!(token_amount(&env.svm, &env.user_token) >= 5_999 * USDC);

    // Another 1,500 USDC in the same window breaches the per-position limit.
    let position: UserPosition = read(&env.svm, &env.position);
    let ix = Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::Withdraw { shares: position.shares * 3 / 8, min_assets_out: 0 }.data(),
        withdraw_accounts(&env),
    );
    assert_vault_error(send(&mut env.svm, &[ix], &user, &[&user]), VaultError::LargeWithdrawalRequiresTimelock);
}

#[test]
fn large_withdrawal_waits_for_timelock() {
    let bytes = require_program!();
    let mut env = initialized(&bytes);
    let user = env.user.insecure_clone();
    let deposit = deposit_ix(&env, 5_000 * USDC);
    send(&mut env.svm, &[deposit], &user, &[&user]).unwrap();
    let position: UserPosition = read(&env.svm, &env.position);

    let request = Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::RequestWithdrawal { shares: position.shares }.data(),
        request_accounts(&env),
    );
    send(&mut env.svm, &[request], &user, &[&user]).unwrap();

    let execute = Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::ExecuteWithdrawal { min_assets_out: 0 }.data(),
        withdraw_accounts(&env),
    );
    assert_vault_error(send(&mut env.svm, &[execute.clone()], &user, &[&user]), VaultError::TimelockActive);

    let mut clock: Clock = env.svm.get_sysvar();
    clock.unix_timestamp += 31 * 60;
    env.svm.set_sysvar(&clock);

    send(&mut env.svm, &[execute], &user, &[&user]).unwrap();
    assert!(token_amount(&env.svm, &env.user_token) >= 9_999 * USDC);
    let vault: Vault = read(&env.svm, &env.vault);
    assert_eq!(vault.total_shares, 0);
    assert_eq!(vault.pending_withdrawal_shares, 0);
}

#[test]
fn guardian_can_pause_but_only_authority_unpauses() {
    let bytes = require_program!();
    let mut env = initialized(&bytes);
    let (guardian, admin, user) = (env.guardian.insecure_clone(), env.admin.insecure_clone(), env.user.insecure_clone());

    let pause = Instruction::new_with_bytes(
        stablesave_vault::id(),
        &ix::Pause {}.data(),
        ix_accounts::Pause { signer: guardian.pubkey(), vault: env.vault }.to_account_metas(None),
    );
    send(&mut env.svm, &[pause], &guardian, &[&guardian]).unwrap();
    let deposit = deposit_ix(&env, 100 * USDC);
    assert_vault_error(send(&mut env.svm, &[deposit], &user, &[&user]), VaultError::VaultPaused);

    let unpause_as = |signer: Pubkey| {
        Instruction::new_with_bytes(
            stablesave_vault::id(),
            &ix::Unpause {}.data(),
            ix_accounts::AdminUpdate { authority: signer, vault: env.vault }.to_account_metas(None),
        )
    };
    assert_vault_error(
        send(&mut env.svm, &[unpause_as(guardian.pubkey())], &guardian, &[&guardian]),
        VaultError::Unauthorized,
    );
    send(&mut env.svm, &[unpause_as(admin.pubkey())], &admin, &[&admin]).unwrap();
    let deposit = deposit_ix(&env, 100 * USDC);
    send(&mut env.svm, &[deposit], &user, &[&user]).unwrap();
}

#[test]
fn strategy_updates_are_validated_on_chain() {
    let bytes = require_program!();
    let mut env = initialized(&bytes);
    let admin = env.admin.insecure_clone();
    let update = |allocations: Vec<Allocation>| {
        Instruction::new_with_bytes(
            stablesave_vault::id(),
            &ix::UpdateStrategy { allocations }.data(),
            ix_accounts::AdminUpdate { authority: admin.pubkey(), vault: env.vault }.to_account_metas(None),
        )
    };
    let bad = vec![
        Allocation { protocol: Protocol::Kamino, weight_bps: 6_000 },
        Allocation { protocol: Protocol::Drift, weight_bps: 3_000 },
    ];
    assert_vault_error(
        send(&mut env.svm, &[update(bad)], &admin, &[&admin]),
        VaultError::AllocationsMustSumToOneHundredPercent,
    );
    let good = vec![
        Allocation { protocol: Protocol::Kamino, weight_bps: 6_000 },
        Allocation { protocol: Protocol::Save, weight_bps: 4_000 },
    ];
    send(&mut env.svm, &[update(good.clone())], &admin, &[&admin]).unwrap();
    let vault: Vault = read(&env.svm, &env.vault);
    assert_eq!(vault.strategy.allocations, good);
    assert_eq!(vault.strategy.version, 2);
}
