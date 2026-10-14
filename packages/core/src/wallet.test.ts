import { describe, expect, it } from "vitest";
import { looksLikeSolanaAddress, sumTokenAccounts, summarizeWallet } from "./index";

const account = (amount: string, decimals = 6) => ({
  pubkey: "x",
  account: { data: { parsed: { info: { tokenAmount: { amount, decimals, uiAmount: Number(amount) / 10 ** decimals } } } } },
});

describe("sumTokenAccounts", () => {
  it("adds up every token account", () => {
    expect(sumTokenAccounts({ jsonrpc: "2.0", result: { value: [account("1240500000"), account("10000")] } })).toBeCloseTo(1240.51, 6);
  });
  it("is zero for a wallet without the token", () => {
    expect(sumTokenAccounts({ result: { context: {}, value: [] } })).toBe(0);
  });
  it("is null for an RPC error or an odd shape", () => {
    expect(sumTokenAccounts({ error: { code: -32602, message: "Invalid param" } })).toBeNull();
    expect(sumTokenAccounts({ result: { value: [{ account: { data: "base64" } }] } })).toBeNull();
    expect(sumTokenAccounts(null)).toBeNull();
  });
});

describe("wallet helpers", () => {
  it("checks the address shape", () => {
    expect(looksLikeSolanaAddress("656xx7QqShXvqNbBj3ppyrpuMCWcXmczhtjCqmhUnHYa")).toBe(true);
    expect(looksLikeSolanaAddress("0x1234")).toBe(false);
    expect(looksLikeSolanaAddress("I0OlI0OlI0OlI0OlI0OlI0OlI0OlI0Ol")).toBe(false);
  });
  it("totals and picks the larger stablecoin", () => {
    const s = summarizeWallet("addr", { USDC: 100, USDT: 300 });
    expect(s.totalUsd).toBe(400);
    expect(s.largest).toBe("USDT");
  });
});
