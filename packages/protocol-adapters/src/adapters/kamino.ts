import type { StableAsset } from "@stablesave/core";
import { BaseYieldAdapter } from "./base";
import type { MarketDataSource } from "../types";

/**
 * Kamino adapter — Kamino Lend reserves and Earn vaults.
 *
 * Transactions: override `getDepositTransaction` / `getWithdrawTransaction`
 * with @kamino-finance/klend-sdk once direct deposits are supported. Until then the base class
 * throws `DirectDepositUnavailableError` and the UI links to the official app.
 */
export class KaminoAdapter extends BaseYieldAdapter {
  static readonly supportedAssets: readonly StableAsset[] = ["USDC", "USDT"];

  constructor(source: MarketDataSource) {
    super({ id: "kamino", supportedAssets: KaminoAdapter.supportedAssets, source });
  }
}
