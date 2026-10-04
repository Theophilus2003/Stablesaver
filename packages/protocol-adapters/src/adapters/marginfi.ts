import type { StableAsset } from "@stablesave/core";
import { BaseYieldAdapter } from "./base";
import type { MarketDataSource } from "../types";

/**
 * MarginFi adapter — MarginFi v2 lending banks.
 *
 * Transactions: override `getDepositTransaction` / `getWithdrawTransaction`
 * with @mrgnlabs/marginfi-client-v2 once direct deposits are supported. Until then the base class
 * throws `DirectDepositUnavailableError` and the UI links to the official app.
 */
export class MarginfiAdapter extends BaseYieldAdapter {
  static readonly supportedAssets: readonly StableAsset[] = ["USDC", "USDT"];

  constructor(source: MarketDataSource) {
    super({ id: "marginfi", supportedAssets: MarginfiAdapter.supportedAssets, source });
  }
}
