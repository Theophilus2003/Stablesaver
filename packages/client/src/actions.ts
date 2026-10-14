import { createNoopSigner, type Address, type Instruction, type TransactionSigner } from "@solana/kit";
import {
  getCancelWithdrawalInstructionAsync,
  getDepositInstructionAsync,
  getExecuteWithdrawalInstructionAsync,
  getRequestWithdrawalInstructionAsync,
  getWithdrawInstructionAsync,
  type UserPosition,
  type Vault,
} from "./generated";
import { assetsForShares, sharesForAssets, sharesForDeposit, withSlippage } from "./math";
import { poolLiquidity, withPoolAccounts, type PracticePoolRef } from "./pools";
import { instantWithdrawalAllowance, vaultTotalAssets } from "./position";

/**
 * Higher-level builders on top of the generated instructions.
 *
 * `owner` may be a real kit `TransactionSigner`, or just an address when the
 * transaction will be signed elsewhere (for example by Solana Wallet Adapter);
 * an address is wrapped in a no-op signer.
 */
export type OwnerInput = TransactionSigner | Address;

function asSigner(owner: OwnerInput): TransactionSigner {
  return typeof owner === "string" ? createNoopSigner(owner) : owner;
}

export interface VaultContext {
  vaultAddress: Address;
  vault: Vault;
  /** Current reserve token balance (base units). */
  reserveAmount: bigint;
  programAddress?: Address;
  /** The vault's practice pools. Withdrawals pull from them when the reserve is short. */
  pools?: readonly PracticePoolRef[];
}

export interface DepositParams extends VaultContext {
  owner: OwnerInput;
  /** Owner's token account for the vault mint. */
  ownerToken: Address;
  amount: bigint;
  slippageBps?: number;
}

export async function buildDepositInstruction(params: DepositParams): Promise<Instruction> {
  const { vault, vaultAddress, reserveAmount, amount, slippageBps = 10 } = params;
  const expectedShares = sharesForDeposit(amount, vaultTotalAssets(vault, reserveAmount), vault.totalShares);
  return getDepositInstructionAsync(
    {
      owner: asSigner(params.owner),
      vault: vaultAddress,
      mint: vault.mint,
      ownerToken: params.ownerToken,
      reserve: vault.reserve,
      amount,
      minSharesOut: withSlippage(expectedShares, slippageBps),
    },
    params.programAddress ? { programAddress: params.programAddress } : undefined,
  );
}

export interface WithdrawParams extends VaultContext {
  owner: OwnerInput;
  ownerToken: Address;
  position: UserPosition;
  /** Amount the user asked for (base units). */
  amount: bigint;
  nowSeconds: bigint;
  slippageBps?: number;
}

export interface WithdrawPlan {
  /** Paid out in this transaction. */
  instant: bigint;
  /** Enters the timelock (base units, estimated at today's share price). */
  timelocked: bigint;
  /** Unix seconds when the timelocked part can be executed. */
  unlockAt: bigint | null;
  instructions: Instruction[];
}

/**
 * Split a withdrawal into the part that can be paid now and the part that
 * must wait for the timelock, and build the instructions for both.
 *
 * The program enforces the same limits; this only avoids sending a
 * transaction that would fail.
 */
export async function buildWithdrawPlan(params: WithdrawParams): Promise<WithdrawPlan> {
  const { vault, vaultAddress, position, reserveAmount, amount, nowSeconds, slippageBps = 10 } = params;
  const total = vaultTotalAssets(vault, reserveAmount);
  const owner = asSigner(params.owner);
  const config = params.programAddress ? { programAddress: params.programAddress } : undefined;

  const balance = assetsForShares(position.shares, total, vault.totalShares);
  const requested = amount > balance ? balance : amount;
  const pools = params.pools ?? [];
  const { available } = instantWithdrawalAllowance(vault, position, reserveAmount, nowSeconds, poolLiquidity(pools));
  const instant = requested < available ? requested : available;

  const instructions: Instruction[] = [];
  let sharesLeft = position.shares;

  if (instant > 0n) {
    const shares = sharesForAssets(instant, total, vault.totalShares, sharesLeft);
    const expected = assetsForShares(shares, total, vault.totalShares);
    instructions.push(
      withPoolAccounts(
        await getWithdrawInstructionAsync(
          {
            owner,
            vault: vaultAddress,
            mint: vault.mint,
            ownerToken: params.ownerToken,
            reserve: vault.reserve,
            shares,
            minAssetsOut: withSlippage(expected, slippageBps),
          },
          config,
        ),
        pools,
      ),
    );
    sharesLeft -= shares;
  }

  const remainder = requested - instant;
  let unlockAt: bigint | null = null;
  if (remainder > 0n && sharesLeft > 0n && position.pendingShares === 0n) {
    const shares = sharesForAssets(remainder, total, vault.totalShares, sharesLeft);
    instructions.push(
      await getRequestWithdrawalInstructionAsync({ owner, vault: vaultAddress, reserve: vault.reserve, shares }, config),
    );
    unlockAt = nowSeconds + vault.limits.withdrawalTimelockSeconds;
  }

  return { instant, timelocked: unlockAt ? remainder : 0n, unlockAt, instructions };
}

export async function buildExecuteWithdrawalInstruction(
  params: VaultContext & { owner: OwnerInput; ownerToken: Address; position: UserPosition; slippageBps?: number },
): Promise<Instruction> {
  const { vault, position, reserveAmount, slippageBps = 10 } = params;
  const expected = assetsForShares(position.pendingShares, vaultTotalAssets(vault, reserveAmount), vault.totalShares);
  const instruction = await getExecuteWithdrawalInstructionAsync(
    {
      owner: asSigner(params.owner),
      vault: params.vaultAddress,
      mint: vault.mint,
      ownerToken: params.ownerToken,
      reserve: vault.reserve,
      minAssetsOut: withSlippage(expected, slippageBps),
    },
    params.programAddress ? { programAddress: params.programAddress } : undefined,
  );
  return withPoolAccounts(instruction, params.pools ?? []);
}

export async function buildCancelWithdrawalInstruction(
  params: Pick<VaultContext, "vaultAddress" | "vault" | "programAddress"> & { owner: OwnerInput },
): Promise<Instruction> {
  return getCancelWithdrawalInstructionAsync(
    { owner: asSigner(params.owner), vault: params.vaultAddress, reserve: params.vault.reserve },
    params.programAddress ? { programAddress: params.programAddress } : undefined,
  );
}
