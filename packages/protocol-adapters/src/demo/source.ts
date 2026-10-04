import type { ProtocolId } from "@stablesave/core";
import type { MarketDataSource, ProtocolMarket } from "../types";
import { demoMarkets } from "./fixtures";

export const DEMO_PROVIDER = "StableSave demo fixtures";

/** Serves illustrative fixtures. Always reports `mode: "demo"`. */
export class DemoMarketSource implements MarketDataSource {
  readonly mode = "demo" as const;
  readonly provider = DEMO_PROVIDER;

  constructor(private readonly protocol: ProtocolId) {}

  async listMarkets(): Promise<ProtocolMarket[]> {
    return demoMarkets(this.protocol);
  }
}
