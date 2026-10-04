import { getAddressEncoder, getProgramDerivedAddress, getUtf8Encoder, type Address, type ProgramDerivedAddress } from "@solana/kit";
import { findPositionPda, findReservePda, STABLESAVE_VAULT_PROGRAM_ADDRESS } from "./generated";

/** 0 = play it safe, 1 = balanced, 2 = go bigger. */
export type RiskProfileId = 0 | 1 | 2;

/** PDA: ["vault", mint, risk_profile] */
export async function findVaultPda(
  seeds: { mint: Address; riskProfile: RiskProfileId },
  config: { programAddress?: Address } = {},
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: config.programAddress ?? STABLESAVE_VAULT_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("vault"), getAddressEncoder().encode(seeds.mint), new Uint8Array([seeds.riskProfile])],
  });
}

export interface VaultAddresses {
  vault: Address;
  reserve: Address;
  position?: Address;
}

/** Every address a client needs for one vault (and optionally one owner). */
export async function deriveVaultAddresses(
  input: { mint: Address; riskProfile: RiskProfileId; owner?: Address },
  config: { programAddress?: Address } = {},
): Promise<VaultAddresses> {
  const [vault] = await findVaultPda(input, config);
  const [reserve] = await findReservePda({ vault }, config);
  if (!input.owner) return { vault, reserve };
  const [position] = await findPositionPda({ vault, owner: input.owner }, config);
  return { vault, reserve, position };
}
