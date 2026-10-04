import type { StableAsset } from "@stablesave/core";
import { BaseYieldAdapter } from "./base";
import type { MarketDataSource } from "../types";

/**
 * Save adapter — Save (formerly Solend) lending pools.
 *
 * Transactions: override `getDepositTransaction` / `getWithdrawTransaction`
 * with @solendprotocol/solend-sdk once direct deposits are supported. Until then the base class
 * throws `DirectDepositUnavailableError` and the UI links to the official app.
 */
export class SaveAdapter extends BaseYieldAdapter {
  static readonly supportedAssets: readonly StableAsset[] = ["USDC", "USDT"];

  constructor(source: MarketDataSource) {
    super({ id: "save", supportedAssets: SaveAdapter.supportedAssets, source });
  }
}
