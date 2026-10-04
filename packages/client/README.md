# @stablesave/client

TypeScript client for the `stablesave_vault` Anchor program. The `src/generated` folder is produced by
[Codama](https://github.com/codama-idl/codama) from `idl/stablesave_vault.json` and targets
[`@solana/kit`](https://github.com/anza-xyz/kit). Everything outside `src/generated` is hand-written.

## Regenerating

```bash
pnpm idl:build          # anchor idl build -> idl/stablesave_vault.json
pnpm generate:client    # scripts/generate-client.mjs -> packages/client/src/generated
```

Never edit `src/generated` by hand; change the program (or a Codama visitor in the script) and regenerate.

## What you get

| Area | Exports |
| --- | --- |
| Instructions | `getDepositInstructionAsync`, `getWithdrawInstructionAsync`, `getRequestWithdrawalInstructionAsync`, `getExecuteWithdrawalInstructionAsync`, `getCancelWithdrawalInstructionAsync`, `getInitializeVaultInstructionAsync`, `getUpdateStrategyInstruction`, `getUpdateLimitsInstruction`, `getPauseInstruction`, `getUnpauseInstruction`, … |
| Accounts | `fetchVault`, `fetchMaybeVault`, `fetchUserPosition`, `fetchMaybeUserPosition`, decoders |
| PDAs | `findVaultPda` (hand-written), `findReservePda`, `findPositionPda`, `deriveVaultAddresses` |
| Types | `Vault`, `UserPosition`, `VaultLimits`, `StrategyConfig`, `Allocation`, `Protocol` |
| Errors | `STABLESAVE_VAULT_ERROR__*` codes, `describeVaultError(code)` (user-facing copy), `extractCustomErrorCode(message)` |
| Helpers | `buildDepositInstruction`, `buildWithdrawPlan`, `buildExecuteWithdrawalInstruction`, `buildCancelWithdrawalInstruction`, `summarizePosition`, `instantWithdrawalAllowance`, share math (`sharesForDeposit`, `assetsForShares`, `toBaseUnits`, …) |
| Wallet Adapter | `toWeb3JsInstruction(s)` from `@stablesave/client/web3js` |

## Fetch a vault and a position

```ts
import { address, createSolanaRpc } from "@solana/kit";
import { deriveVaultAddresses, fetchVault, fetchMaybeUserPosition, summarizePosition, fromBaseUnits } from "@stablesave/client";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const { vault, reserve, position } = await deriveVaultAddresses({
  mint: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // devnet USDC
  riskProfile: 1,                                                // 0 safe · 1 balanced · 2 bigger
  owner: address(walletAddress),
});

const vaultAccount = await fetchVault(rpc, vault);
const reserveAmount = BigInt((await rpc.getTokenAccountBalance(reserve).send()).value.amount);
const positionAccount = await fetchMaybeUserPosition(rpc, position!);

if (positionAccount.exists) {
  const summary = summarizePosition(vaultAccount.data, positionAccount.data, reserveAmount);
  console.log("balance", fromBaseUnits(summary.totalAssets), "earned", fromBaseUnits(summary.earned));
}
```

## Deposit

```ts
import { buildDepositInstruction, toBaseUnits } from "@stablesave/client";

const ix = await buildDepositInstruction({
  vaultAddress: vault,
  vault: vaultAccount.data,
  reserveAmount,
  owner: signer,            // kit TransactionSigner — or a plain address if another wallet signs
  ownerToken: usdcTokenAccount,
  amount: toBaseUnits(10_000),
  slippageBps: 10,          // min shares out = expected − 0.1%
});
```

Send it with kit (`pipe(createTransactionMessage…)`, see `scripts/initialize-vaults.ts`) or, with Solana Wallet
Adapter:

```ts
import { Transaction } from "@solana/web3.js";
import { toWeb3JsInstructions } from "@stablesave/client/web3js";

const tx = new Transaction().add(...toWeb3JsInstructions([ix]));
const signature = await wallet.sendTransaction(tx, connection);
```

## Withdraw (instant + timelocked)

`buildWithdrawPlan` mirrors the program's limits: it pays out what's allowed instantly (per-position and per-vault
window caps, reserve liquidity) and builds a `request_withdrawal` for the rest.

```ts
const plan = await buildWithdrawPlan({
  vaultAddress: vault, vault: vaultAccount.data, position: positionAccount.data,
  reserveAmount, owner: signer, ownerToken: usdcTokenAccount,
  amount: toBaseUnits(5_000), nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
});
// plan.instant, plan.timelocked, plan.unlockAt, plan.instructions
```

After `unlockAt`, call `buildExecuteWithdrawalInstruction`; `buildCancelWithdrawalInstruction` returns the locked
shares. The program enforces every limit itself — these helpers only avoid sending transactions that would fail.

## Initialize vaults (operators)

```bash
pnpm --filter @stablesave/client init-vaults -- --rpc https://api.devnet.solana.com --mint <USDC mint> --keypair ~/.config/solana/id.json
```

The signer must be the program's upgrade authority. The script uses example allocations; replace them first.
