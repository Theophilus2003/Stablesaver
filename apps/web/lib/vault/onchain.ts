import { address, createSolanaRpc, type Address, type Instruction } from "@solana/kit";
import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
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
  const blend = blendStrategy(strategyFromVault(state), opportunities, balance);
  if (!blend) return null;
  const allowance = position
    ? instantWithdrawalAllowance(vault, position, state.reserveAmount, nowSeconds, poolLiquidity(state.pools))
    : null;
  const onchain = breakdown(state);
  // With money in the pools, show this position's real share of each pool at its practice rate.
  const positions: PortfolioPosition[] =
    onchain && onchain.vaultTotal > 0 && vault.deployedAssets > 0n
      ? onchain.pools.map((pool) => {
          const leg = blend.legs.find((l) => l.allocation.protocolId === pool.protocolId);
          return {
            protocolId: pool.protocolId,
            name: pool.name,
            amount: (pool.amount * balance) / onchain.vaultTotal,
            apy: pool.apy,
            grade: leg?.opportunity.safety.display ?? "—",
            weightBps: pool.targetBps,
            marketName: "Practice pool",
          };
        })
      : positionsFromBlend(blend, balance);
  const practiceApy =
    onchain && onchain.vaultTotal > 0 && vault.deployedAssets > 0n
      ? onchain.pools.reduce((sum, pool) => sum + pool.amount * pool.apy, 0) / onchain.vaultTotal
      : null;

  return {
    source: "onchain",
    profile: state.profile,
    balance,
    earned: summary ? signedUsd(summary.earned) : 0,
    apy: practiceApy ?? blend.apy,
    grade: blend.safety.display,
    allocations: blend.strategy.allocations,
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
}

async function send(ctx: SendContext, instructions: Instruction[]): Promise<string> {
  const tx = new Transaction().add(...toWeb3JsInstructions(instructions));
  tx.feePayer = new PublicKey(ctx.owner);
  const latest = await ctx.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const signature = await ctx.sendTransaction(tx, ctx.connection);
  const result = await ctx.connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  return signature;
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
  const code = extractCustomErrorCode(message);
  if (code !== null) return describeVaultError(code) ?? `The program rejected the transaction (error ${code}).`;
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}
