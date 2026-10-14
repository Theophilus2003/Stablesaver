<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../apps/web/public/brand/stablesave-logo-dark.svg">
  <img src="../apps/web/public/brand/stablesave-logo-light.svg" alt="StableSave" width="180">
</picture>

# Testing the vault on devnet

The StableSave Vault runs as a simulated preview until its program is deployed. This guide deploys it to Solana
**devnet** from GitHub Actions (no Solana tools needed on your computer), creates a free test token, sends some to
your wallet, and points the website at it. Devnet tokens have no value.

## 1. Make a deployer key (devnet only)

The deployer pays for the deploy and becomes the vault's admin. Use a fresh account that never holds real funds.

- **Phantom:** add a new account (for example "StableSave devnet deployer"), then Settings → that account → Show
  private key, and copy it.
- **Solana CLI:** `solana-keygen new -o deployer.json` and copy the file's contents (`[12,34,…]`).

## 2. Fund it with devnet SOL

Copy the deployer's address and get devnet SOL from <https://faucet.solana.com>. The first deploy needs about
**5 SOL** in the account while it runs; about 2.4 SOL stays locked in the program account and the rest comes back.
If it's short, the run stops before deploying and says how much it needs. Later runs need very little.

## 3. Add the key to GitHub

Repository → Settings → Secrets and variables → Actions → **New repository secret**

- Name: `DEVNET_DEPLOYER_KEY`
- Value: the private key from step 1

Optional: a repository *variable* `DEVNET_RPC_URL` if you want to use your own devnet RPC (Helius, Triton, …)
instead of the public one.

## 4. Run the workflow

Actions → **Vault program** → **Run workflow**:

| Field | What to put |
| --- | --- |
| Wallet | The wallet you'll test with (not the deployer). It receives the test tokens. |
| Amount | How many test tokens to send (default 10,000). |
| Mint | Leave empty to use a new StableSave test token. Or paste an existing 6-decimal token, e.g. Circle's devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (get it from <https://faucet.circle.com>; the workflow can't mint it). |

It builds the program, runs its tests, rehearses everything on a local validator (deploy, test token, vaults, a
deposit and a withdrawal), then deploys to devnet. It takes about 10 minutes. The run's **Summary** lists the values
for the next step.

Run it again any time: it upgrades the same program (the program id is derived from your deployer key), keeps
existing vaults, and sends more test tokens if you fill in a wallet.

## 5. Point the website at it

In Vercel → the web project → Settings → Environment Variables, add the three values from the summary and redeploy:

```
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_STABLESAVE_VAULT_PROGRAM_ID=<program id>
NEXT_PUBLIC_STABLESAVE_VAULT_MINT=<test token>
```

The vault pages switch from **Preview** to real devnet transactions, with a **Devnet** badge.

## 6. Test

1. In your wallet, switch to devnet (Phantom: Settings → Developer settings → Testnet mode → Solana Devnet). Your
   test wallet needs a little devnet SOL for fees.
2. Open the site → **Vault** → **Connect wallet** → **Deposit**. Step 1 shows your test-token balance.
3. Confirm in your wallet. The dashboard shows your balance from the chain.
4. **Withdraw** up to $2,000 per 24 hours instantly; anything above that waits 30 minutes (the large-withdrawal
   timelock), then you complete it from the dashboard.
5. On the dashboard, **Where the vault's money is** shows the whole vault from the chain: 20% kept liquid and the
   rest in a practice pool per protocol. **Collect interest & rebalance** pays the pools their interest and moves
   them back to their targets; anyone can press it.
6. On the Vault page, **Open Blink** opens the deposit as a Solana Blink on dial.to. Anyone with test tokens can
   deposit from that link or a QR code of it.

## What's real and what isn't

- **Real on devnet:** deposits, shares, withdrawals, per-wallet and vault-wide limits, the timelock, the guardian
  pause, and the split into practice pools. Every deposit is rebalanced in the same transaction; withdrawals pull
  back from the pools when the reserve is short.
- **Practice, not market:** the pools stand in for Kamino, MarginFi, Drift and Save. They hold real test tokens and
  pay fixed practice rates (5.20%, 5.90%, 6.80%, 5.05%) from each vault's yield sponsor, which setup tops up with
  5,000 test tokens. CPI into the real protocols is the next milestone.
- The allocations are the example weights from `packages/client/scripts/initialize-vaults.ts`.

## Already deployed before practice pools?

Run the **Vault program** workflow again. It upgrades the program in place (same program id, so Vercel needs no
changes), keeps your vaults and positions, opens the practice pools and funds their sponsor. Existing deposits move
into the pools on the next deposit or **Collect interest & rebalance**.

## Without GitHub Actions

With the Solana CLI and `pnpm install` done locally:

```bash
STABLESAVE_DEPLOYER_KEY="$(cat ~/.config/solana/id.json)" \
  scripts/deploy-vault.sh https://api.devnet.solana.com --to <your wallet> --amount 10000
```
