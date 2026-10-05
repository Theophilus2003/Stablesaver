import type { ProtocolId } from "@stablesave/core";

export class LiveDataUnavailableError extends Error {
  override readonly name = "LiveDataUnavailableError";
  constructor(
    /** The protocol or provider whose data couldn't be loaded. */
    readonly sourceId: string,
    message: string,
  ) {
    super(message);
  }
}

export class DirectDepositUnavailableError extends Error {
  override readonly name = "DirectDepositUnavailableError";
  constructor(
    readonly protocolId: ProtocolId,
    readonly officialUrl: string,
  ) {
    super(`StableSave doesn't build ${protocolId} transactions yet. Deposit on the official app: ${officialUrl}`);
  }
}

export class UnknownMarketError extends Error {
  override readonly name = "UnknownMarketError";
  constructor(
    readonly protocolId: ProtocolId,
    readonly marketId: string,
  ) {
    super(`${protocolId} has no market "${marketId}"`);
  }
}
