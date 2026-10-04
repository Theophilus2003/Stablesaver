import type { ProtocolId } from "@stablesave/core";

export class LiveDataUnavailableError extends Error {
  override readonly name = "LiveDataUnavailableError";
  constructor(
    readonly protocolId: ProtocolId,
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
