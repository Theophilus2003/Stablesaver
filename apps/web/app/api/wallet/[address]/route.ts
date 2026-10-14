import { SOLANA_STABLECOIN_MINTS, looksLikeSolanaAddress, sumTokenAccounts, summarizeWallet } from "@stablesave/core";
import { NextResponse } from "next/server";

/**
 * USDC and USDT held by a Solana wallet on mainnet. Read-only: public balances,
 * nothing to sign. Set SOLANA_MAINNET_RPC_URL to use your own RPC provider.
 */
function rpcUrl(): string {
  return process.env.SOLANA_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";
}

async function balanceOf(owner: string, mint: string): Promise<number | null> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  return sumTokenAccounts(await res.json());
}

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!looksLikeSolanaAddress(address)) {
    return NextResponse.json({ error: "That doesn't look like a Solana wallet address." }, { status: 400 });
  }
  try {
    const [usdc, usdt] = await Promise.all([
      balanceOf(address, SOLANA_STABLECOIN_MINTS.USDC),
      balanceOf(address, SOLANA_STABLECOIN_MINTS.USDT),
    ]);
    if (usdc === null || usdt === null) throw new Error("unreadable");
    return NextResponse.json(summarizeWallet(address, { USDC: usdc, USDT: usdt }), {
      headers: { "cache-control": "private, max-age=30" },
    });
  } catch {
    return NextResponse.json({ error: "We couldn't read this wallet right now. Try again in a moment." }, { status: 502 });
  }
}
