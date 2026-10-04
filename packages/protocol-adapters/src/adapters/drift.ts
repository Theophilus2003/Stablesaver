import type { StableAsset } from "@stablesave/core";
import { BaseYieldAdapter } from "./base";
import type { MarketDataSource } from "../types";

/**
 * Drift adapter — Drift v2 spot markets and the insurance fund.
 *
 * Transactions: override `getDepositTransaction` / `getWithdrawTransaction`
 * with @drift-labs/sdk once direct deposits are supported. Until then the base class
 * throws `DirectDepositUnavailableError` and the UI links to the official app.
 */
export class DriftAdapter extends BaseYieldAdapter {
  static readonly supportedAssets: readonly StableAsset[] = ["USDC", "USDT"];

  constructor(source: MarketDataSource) {
    super({ id: "drift", supportedAssets: DriftAdapter.supportedAssets, source });
  }
}
