import { address, createSolanaRpc, type Address, type Instruction } from "@solana/kit";
import { ComputeBudgetProgram, PublicKey, Transaction, type Connection } from "@solana/web3.js";
import {
  buildCancelWithdrawalInstruction,
  buildDepositInstruction,
  buildExecuteWithdrawalInstruction,
  buildSyncPoolsInstructions,
  buildWithdrawPlan,
  deriveVaultAddresses,
  fetchPracticePools,
  poolLiquidity,
  describeVaultError,
  extractCustomErrorCode,
  fetchMaybeUserPosition,
  fetchMaybeVault,
  fromBaseUnits,
  instantWithdrawalAllowance,
  LIQUIDITY_BUFFER_BPS,
  summarizePosition,
  toBaseUnits,
  type PracticePoolRef,
  type RiskProfileId,
  type UserPosition,
  type Vault,
} from "@stablesave/client";
import { toWeb3JsInstructions } from "@stablesave/client/web3js";
import {
  PROTOCOLS,
  RISK_PROFILE_IDS,
  RISK_PROFILES,
  blendStrategy,
  protocolFromOnchainId,
  type RatedOpportunity,
  type RiskProfile,
  type StrategyAllocation,
  type VaultStrategy,
} from "@stablesave/core";
import { DEFAULT_USDC_MARKET } from "./config";
import { positionsFromBlend, type OnchainBreakdown, type Portfolio, type PortfolioPosition } from "./portfolio";

/**
 * Talks to a deployed StableSave vault: reads accounts with the Codama client
 * (@solana/kit) and sends transactions through Solana Wallet Adapter.
 */

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export interface OnchainConfig {
  rpcUrl: string;
  programId: string;
  mint: string;
}

export interface OnchainVaultState {
  profile: RiskProfile;
  programAddress: Address;
  vaultAddress: Address;
  vault: Vault;
  reserveAmount: bigint;
  position: UserPosition | null;
  /** Practice pools the vault has opened. Empty before the allocator is set up. */
  pools: PracticePoolRef[];
}

/** Associated token account for (owner, mint) on the legacy token program. */
export function associatedTokenAddress(owner: string, mint: string): Address {
  const [ata] = PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBuffer(), TOKEN_PROGRAM.toBuffer(), new PublicKey(mint).toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM,
  );
  return address(ata.toBase58());
}

/** The owner's balance of the vault token, in whole units. 0 when they have no token account yet. */
export async function walletTokenBalance(config: OnchainConfig, owner: string): Promise<number> {
  const rpc = createSolanaRpc(config.rpcUrl);
  try {
    const { value } = await rpc.getTokenAccountBalance(associatedTokenAddress(owner, config.mint)).send();
    return fromBaseUnits(BigInt(value.amount), value.decimals);
  } catch (error) {
    if (/could not find account|Invalid param/i.test(error instanceof Error ? error.message : String(error))) return 0;
    throw error;
  }
}

/** Load every risk-profile vault for the configured mint, plus the owner's positions. */
export async function loadVaults(config: OnchainConfig, owner?: string): Promise<OnchainVaultState[]> {
  const rpc = createSolanaRpc(config.rpcUrl);
  const programAddress = address(config.programId);
  const mint = address(config.mint);

  const results = await Promise.all(
    RISK_PROFILE_IDS.map(async (profile): Promise<OnchainVaultState | null> => {
      const ids = await deriveVaultAddresses(
        {
          mint,
          riskProfile: RISK_PROFILES[profile].onchainId as RiskProfileId,
          ...(owner ? { owner: address(owner) } : {}),
        },
        { programAddress },
      );
      const vaultAccount = await fetchMaybeVault(rpc, ids.vault);
      if (!vaultAccount.exists) return null;
      const [reserve, pools] = await Promise.all([
        rpc.getTokenAccountBalance(vaultAccount.data.reserve).send(),
        fetchPracticePools(rpc, ids.vault, { programAddress }),
      ]);
      let position: UserPosition | null = null;
      if (ids.position) {
        const p = await fetchMaybeUserPosition(rpc, ids.position);
        position = p.exists ? p.data : null;
      }
      return {
        profile,
        programAddress,
        vaultAddress: ids.vault,
        vault: vaultAccount.data,
        reserveAmount: BigInt(reserve.value.amount),
        position,
        pools,
      };
    }),
  );
  return results.filter((r): r is OnchainVaultState => r !== null);
}

export function strategyFromVault(state: OnchainVaultState): VaultStrategy {
  const allocations: StrategyAllocation[] = state.vault.strategy.allocations.flatMap((a) => {
    const protocolId = protocolFromOnchainId(a.protocol);
    return protocolId ? [{ protocolId, opportunityId: DEFAULT_USDC_MARKET[protocolId], weightBps: a.weightBps }] : [];
  });
  return {
    profile: state.profile,
    name: RISK_PROFILES[state.profile].label,
    version: state.vault.strategy.version,
    source: "onchain",
    allocations,
    managementFeeBps: 0,
    vaultLayerRiskPoints: 4,
  };
}

function signedUsd(value: bigint): number {
  return value < 0n ? -fromBaseUnits(-value) : fromBaseUnits(value);
}

export function onchainPortfolio(
  state: OnchainVaultState,
  opportunities: readonly RatedOpportunity[],
  nowSeconds = BigInt(Math.floor(Date.now() / 1000)),
): Portfolio | null {
  const { position, vault } = state;
  const summary = position ? summarizePosition(vault, position, state.reserveAmount) : null;
  const balance = summary ? fromBaseUnits(summary.totalAssets) : 0;
  const strategy = strategyFromVault(state);
  const blend = blendStrategy(strategy, opportunities, balance);
  const onchain = breakdown(state);
  // Market data only adds the grades. With practice pools the vault can still be shown from what's
  // on-chain, so an outage of the market feed doesn't take the vault page down with it.
  if (!blend && !onchain) return null;
  const allowance = position
    ? instantWithdrawalAllowance(vault, position, state.reserveAmount, nowSeconds, poolLiquidity(state.pools))
    : null;
  const deployed = onchain !== null && onchain.vaultTotal > 0 && vault.deployedAssets > 0n;
  const gradeFor = (protocolId: string) => blend?.legs.find((l) => l.allocation.protocolId === protocolId)?.opportunity.safety.display ?? "—";
  const totalWeight = onchain ? onchain.pools.reduce((sum, pool) => sum + pool.targetBps, 0) || 1 : 1;
  // With money in the pools, show this position's real share of each pool at its practice rate.
  const positions: PortfolioPosition[] = deployed
    ? onchain.pools.map((pool) => ({
        protocolId: pool.protocolId,
        name: pool.name,
        amount: (pool.amount * balance) / onchain.vaultTotal,
        apy: pool.apy,
        grade: gradeFor(pool.protocolId),
        weightBps: pool.targetBps,
        marketName: "Practice pool",
      }))
    : blend
      ? positionsFromBlend(blend, balance)
      : onchain!.pools.map((pool) => ({
          protocolId: pool.protocolId,
          name: pool.name,
          amount: (balance * pool.targetBps) / totalWeight,
          apy: pool.apy,
          grade: "—",
          weightBps: pool.targetBps,
          marketName: "Practice pool",
        }));
  const practiceApy = deployed
    ? onchain.pools.reduce((sum, pool) => sum + pool.amount * pool.apy, 0) / onchain.vaultTotal
    : null;
  // Nothing deployed and no market data: the pools' practice rates, less the share kept liquid.
  const targetPracticeApy = onchain
    ? (onchain.pools.reduce((sum, pool) => sum + pool.apy * pool.targetBps, 0) / totalWeight) * (1 - LIQUIDITY_BUFFER_BPS / 10_000)
    : 0;

  return {
    source: "onchain",
    profile: state.profile,
    balance,
    earned: summary ? signedUsd(summary.earned) : 0,
    apy: practiceApy ?? blend?.apy ?? targetPracticeApy,
    grade: blend?.safety.display ?? "—",
    allocations: blend?.strategy.allocations ?? strategy.allocations,
    positions,
    history: [],
    pending:
      position && summary && position.pendingShares > 0n
        ? {
            amount: fromBaseUnits(summary.pendingAssets),
            requestedAt: Number(position.pendingRequestedTs) * 1000,
            unlockAt: Number(position.pendingUnlockTs) * 1000,
          }
        : null,
    instantAvailable: allowance ? fromBaseUnits(allowance.available) : 0,
    limits: {
      largeWithdrawalThreshold: fromBaseUnits(vault.limits.largeWithdrawalThreshold),
      withdrawalTimelockSeconds: Number(vault.limits.withdrawalTimelockSeconds),
      windowSeconds: Number(vault.limits.windowSeconds),
    },
    hasDeposits: balance > 0,
    undeployed: vault.deployedAssets === 0n,
    onchain: onchain ?? undefined,
  };
}

/** The whole vault's money by place: reserve plus each practice pool. Null without pools. */
function breakdown(state: OnchainVaultState): OnchainBreakdown | null {
  if (state.pools.length === 0) return null;
  const weights = new Map(state.vault.strategy.allocations.map((a) => [a.protocol as number, a.weightBps]));
  const pools = state.pools.flatMap((pool) => {
    const protocolId = protocolFromOnchainId(pool.data.protocol);
    if (!protocolId) return [];
    return [
      {
        protocolId,
        name: PROTOCOLS[protocolId].name,
        amount: fromBaseUnits(pool.data.deployed),
        apy: pool.data.apyBps / 10_000,
        interestPaid: fromBaseUnits(pool.data.interestPaid),
        targetBps: weights.get(pool.data.protocol as number) ?? 0,
      },
    ];
  });
  const reserve = fromBaseUnits(state.reserveAmount);
  return { vaultTotal: reserve + pools.reduce((s, p) => s + p.amount, 0), reserve, pools };
}

export interface SendContext {
  connection: Connection;
  owner: string;
  mint: string;
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
  /** When the wallet offers it, it only signs and the site sends (see submitTransaction). */
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  /** Called once the transaction is on its way, before it confirms. */
  onSent?: (signature: string) => void;
}

const POLL_MS = 2_000;
/** Priority fee in micro-lamports per compute unit: at least this, more when recent fees are higher. */
const MIN_PRIORITY_FEE = 50_000;
const MAX_PRIORITY_FEE = 1_000_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Adds a small priority fee (unless the transaction already sets one) so busy leaders don't skip it. */
async function addPriorityFee(connection: Connection, tx: Transaction): Promise<void> {
  if (tx.instructions.some((ix) => ix.programId.equals(ComputeBudgetProgram.programId))) return;
  const writable = [...new Map(tx.instructions.flatMap((ix) => ix.keys.filter((k) => k.isWritable).map((k) => [k.pubkey.toBase58(), k.pubkey] as const))).values()];
  const recent = await attempt(() => connection.getRecentPrioritizationFees({ lockedWritableAccounts: writable.slice(0, 128) }));
  const fees = (recent ?? []).map((f) => f.prioritizationFee).sort((a, b) => a - b);
  const median = fees.length ? fees[Math.floor(fees.length / 2)]! : 0;
  const microLamports = Math.min(MAX_PRIORITY_FEE, Math.max(MIN_PRIORITY_FEE, median));
  tx.instructions = [ComputeBudgetProgram.setComputeUnitPrice({ microLamports }), ...tx.instructions];
}

/**
 * Waits for the signature by polling (no websocket), sending the transaction again every couple
 * of seconds while it is pending. Gives up only once the blockhash has expired and a final lookup
 * still can't find it, so "expired" means it can no longer land.
 */
async function waitForConfirmation(
  connection: Connection,
  signature: string,
  expired: () => Promise<boolean>,
  resend?: () => Promise<unknown>,
): Promise<void> {
  const check = async (searchTransactionHistory: boolean) => {
    const res = await attempt(() => connection.getSignatureStatuses([signature], { searchTransactionHistory }));
    const status = res?.value[0];
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    return status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized";
  };
  while (!(await check(false))) {
    if (await expired()) {
      for (let i = 0; i < 3; i++) {
        if (await check(true)) return;
        await sleep(POLL_MS);
      }
      throw new Error(`Signature ${signature} has expired: block height exceeded.`);
    }
    if (resend) await attempt(resend);
    await sleep(POLL_MS);
  }
}

/**
 * Simulate on the site's cluster, have the wallet sign, then send it ourselves. Because the wallet
 * only signs, the transaction goes to this cluster even when the wallet is set to another one, and
 * problems (no SOL for fees, not enough tokens, a program check) show before the wallet opens.
 */
export async function submitTransaction(
  ctx: Pick<SendContext, "connection" | "sendTransaction" | "signTransaction" | "onSent">,
  tx: Transaction,
): Promise<string> {
  const { connection } = ctx;
  await addPriorityFee(connection, tx);
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const simulation = await connection.simulateTransaction(tx);
  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)} ${(simulation.value.logs ?? []).join(" ")}`);
  }
  const pastBlockHeight = async () => {
    const height = await attempt(() => connection.getBlockHeight("confirmed"));
    return height !== null && height > latest.lastValidBlockHeight;
  };

  if (!ctx.signTransaction) {
    const signature = await ctx.sendTransaction(tx, connection);
    ctx.onSent?.(signature);
    await waitForConfirmation(connection, signature, pastBlockHeight);
    return signature;
  }

  const signed = await ctx.signTransaction(tx);
  const raw = signed.serialize();
  const signature = await connection.sendRawTransaction(raw, { preflightCommitment: "confirmed", maxRetries: 0 });
  ctx.onSent?.(signature);
  // A wallet may swap in its own blockhash; then ask the cluster whether that one is still valid.
  const blockhash = signed.recentBlockhash;
  const expired =
    blockhash && blockhash !== latest.blockhash
      ? async () => (await attempt(() => connection.isBlockhashValid(blockhash, { commitment: "confirmed" })))?.value === false
      : pastBlockHeight;
  await waitForConfirmation(connection, signature, expired, () =>
    connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }),
  );
  return signature;
}

async function send(ctx: SendContext, instructions: Instruction[]): Promise<string> {
  const tx = new Transaction().add(...toWeb3JsInstructions(instructions));
  tx.feePayer = new PublicKey(ctx.owner);
  return submitTransaction(ctx, tx);
}

export async function depositOnchain(ctx: SendContext, state: OnchainVaultState, amountUsd: number) {
  const ix = await buildDepositInstruction({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    reserveAmount: state.reserveAmount,
    owner: address(ctx.owner),
    ownerToken: associatedTokenAddress(ctx.owner, ctx.mint),
    amount: toBaseUnits(amountUsd),
    programAddress: state.programAddress,
  });
  // Split the deposit into the practice pools in the same transaction.
  const sync = await buildSyncPoolsInstructions({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    pools: state.pools,
    programAddress: state.programAddress,
  });
  return send(ctx, [ix, ...sync]);
}

/** Pay the pools their interest and move each toward its strategy weight. Anyone can do this. */
export async function syncPoolsOnchain(ctx: SendContext, state: OnchainVaultState) {
  const ixs = await buildSyncPoolsInstructions({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    pools: state.pools,
    programAddress: state.programAddress,
  });
  if (ixs.length === 0) throw new Error("This vault has no practice pools yet.");
  return send(ctx, ixs);
}

export async function withdrawOnchain(ctx: SendContext, state: OnchainVaultState, amountUsd: number) {
  if (!state.position) throw new Error("You don't have a position in this vault.");
  const plan = await buildWithdrawPlan({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    position: state.position,
    reserveAmount: state.reserveAmount,
    owner: address(ctx.owner),
    ownerToken: associatedTokenAddress(ctx.owner, ctx.mint),
    amount: toBaseUnits(amountUsd),
    nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
    programAddress: state.programAddress,
    pools: state.pools,
  });
  return { signature: await send(ctx, plan.instructions), plan };
}

export async function executeOnchain(ctx: SendContext, state: OnchainVaultState) {
  if (!state.position) throw new Error("You don't have a position in this vault.");
  const ix = await buildExecuteWithdrawalInstruction({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    reserveAmount: state.reserveAmount,
    owner: address(ctx.owner),
    ownerToken: associatedTokenAddress(ctx.owner, ctx.mint),
    position: state.position,
    programAddress: state.programAddress,
    pools: state.pools,
  });
  return send(ctx, [ix]);
}

export async function cancelOnchain(ctx: SendContext, state: OnchainVaultState) {
  const ix = await buildCancelWithdrawalInstruction({
    vaultAddress: state.vaultAddress,
    vault: state.vault,
    owner: address(ctx.owner),
    programAddress: state.programAddress,
  });
  return send(ctx, [ix]);
}

/** Wallet and program errors as one plain sentence. */
export function describeTxError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancel/i.test(message)) return "You cancelled the request in your wallet.";
  if (/AccountNotFound|InsufficientFundsForFee|no record of a prior credit/i.test(message)) {
    return "This wallet has no devnet SOL to pay the network fee. Get some at faucet.solana.com (choose Devnet) and try again.";
  }
  if (/insufficient funds/i.test(message)) return "This wallet doesn't hold enough test USDC for that amount.";
  if (/block height exceeded|has expired/i.test(message)) {
    return "The network didn't confirm the transaction before it expired, so nothing left your wallet. Try again; if it keeps happening, check that your wallet is on Devnet and has a little devnet SOL.";
  }
  if (/mainnet|mismatch|wrong network|different network|unsupported chain|chain.*not supported/i.test(message)) {
    return "Your wallet is on a different network. Switch it to Devnet (Solflare: Settings → Network; Phantom: Settings → Developer settings → Testnet mode) and try again.";
  }
  const code = extractCustomErrorCode(message);
  if (code !== null) return describeVaultError(code) ?? `The program rejected the transaction (error ${code}).`;
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}
