import { buildDepositInstruction, buildSyncPoolsInstructions, toBaseUnits } from "@stablesave/client";
import { toWeb3JsInstructions } from "@stablesave/client/web3js";
import { RISK_PROFILES, RISK_PROFILE_IDS } from "@stablesave/core";
import { address } from "@solana/kit";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { actionHeaders, type ActionGetResponse, type ActionPostResponse } from "@/lib/actions/solana-actions";
import { getPublicEnv } from "@/lib/env";
import { parseRiskParam } from "@/lib/search-params";
import { associatedTokenAddress, loadVaults, walletTokenBalance } from "@/lib/vault/onchain";

/**
 * Solana Action (Blink): deposit test USDC into the StableSave Vault.
 * GET describes the action; POST returns an unsigned deposit transaction for
 * the wallet in the request body to sign. Nothing is signed or sent here.
 */

const MAX_DEPOSIT = 1_000_000;

function clusterName(cluster: string): string {
  return cluster === "mainnet-beta" ? "Solana" : `Solana ${cluster}`;
}

export function GET(request: Request) {
  const env = getPublicEnv();
  const origin = new URL(request.url).origin;
  const href = `${origin}/api/actions/deposit`;
  const body: ActionGetResponse = {
    type: "action",
    icon: `${origin}/brand/stablesave-icon-512.png`,
    title: "StableSave Vault",
    description: `Deposit test USDC into the StableSave Vault on ${clusterName(env.cluster)}. The vault splits it across practice lending pools by the risk level you pick, and you can withdraw any time. Test tokens have no value.`,
    label: "Deposit",
    links: {
      actions: [
        { type: "transaction", label: "Deposit 10", href: `${href}?amount=10&risk=balanced` },
        { type: "transaction", label: "Deposit 100", href: `${href}?amount=100&risk=balanced` },
        {
          type: "transaction",
          label: "Deposit",
          href: `${href}?amount={amount}&risk={risk}`,
          parameters: [
            { type: "number", name: "amount", label: "Amount (test USDC)", required: true, min: 1, max: MAX_DEPOSIT },
            {
              type: "select",
              name: "risk",
              label: "Risk level",
              required: true,
              options: RISK_PROFILE_IDS.map((id) => ({ label: RISK_PROFILES[id].label, value: id, selected: id === "balanced" })),
            },
          ],
        },
      ],
    },
  };
  if (!env.vaultDeployed) {
    body.disabled = true;
    body.error = { message: "The vault isn't deployed on this site yet." };
  }
  return NextResponse.json(body, { headers: actionHeaders(env.cluster) });
}

export function OPTIONS() {
  return new Response(null, { headers: actionHeaders(getPublicEnv().cluster) });
}

export async function POST(request: Request) {
  const env = getPublicEnv();
  const headers = actionHeaders(env.cluster);
  const fail = (message: string, status = 400) => NextResponse.json({ message }, { status, headers });

  if (!env.vaultDeployed || !env.vaultProgramId || !env.vaultMint) return fail("The vault isn't deployed on this site yet.");

  const url = new URL(request.url);
  const amount = Number(url.searchParams.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT) return fail("Enter an amount between 1 and 1,000,000.");
  const profile = parseRiskParam(url.searchParams.get("risk") ?? undefined);

  let account: PublicKey;
  try {
    const body = (await request.json()) as { account?: unknown };
    account = new PublicKey(String(body.account));
  } catch {
    return fail("Missing or invalid wallet account.");
  }
  const owner = account.toBase58();
  const config = { rpcUrl: env.rpcUrl, programId: env.vaultProgramId, mint: env.vaultMint };

  try {
    const state = (await loadVaults(config)).find((v) => v.profile === profile);
    if (!state) return fail(`The ${RISK_PROFILES[profile].label} vault isn't open yet.`);
    if (state.vault.paused) return fail("The vault is paused right now. Deposits are off until it's checked.");
    const units = toBaseUnits(amount);
    if (units < state.vault.limits.minDeposit) return fail("That's below the vault's minimum deposit.");

    const balance = await walletTokenBalance(config, owner);
    if (balance < amount) {
      return fail(
        balance > 0
          ? `This wallet has ${balance.toLocaleString("en-US")} test USDC on ${env.cluster}; the deposit needs ${amount.toLocaleString("en-US")}.`
          : `This wallet has no test USDC on ${env.cluster}. Get some from the StableSave devnet workflow first.`,
      );
    }

    const ix = await buildDepositInstruction({
      vaultAddress: state.vaultAddress,
      vault: state.vault,
      reserveAmount: state.reserveAmount,
      owner: address(owner),
      ownerToken: associatedTokenAddress(owner, env.vaultMint),
      amount: units,
      programAddress: state.programAddress,
    });
    // Split the deposit into the practice pools in the same transaction.
    const sync = await buildSyncPoolsInstructions({
      vaultAddress: state.vaultAddress,
      vault: state.vault,
      pools: state.pools,
      programAddress: state.programAddress,
    });
    const connection = new Connection(env.rpcUrl, "confirmed");
    const tx = new Transaction().add(...toWeb3JsInstructions([ix, ...sync]));
    tx.feePayer = account;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

    const body: ActionPostResponse = {
      type: "transaction",
      transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
      message: `Deposits ${amount.toLocaleString("en-US")} test USDC into the ${RISK_PROFILES[profile].label} vault on ${env.cluster}. Test tokens have no value.`,
    };
    return NextResponse.json(body, { headers });
  } catch (error) {
    console.warn("[actions/deposit]", error);
    return fail("We couldn't build the deposit right now. Try again in a moment.", 502);
  }
}
