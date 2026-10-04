/**
 * Bridge for apps that sign with Solana Wallet Adapter (@solana/web3.js v1).
 * The generated client produces @solana/kit instructions; convert them here.
 */
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { isSignerRole, isWritableRole, type Instruction } from "@solana/kit";

export function toWeb3JsInstruction(instruction: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programAddress),
    keys: (instruction.accounts ?? []).map((meta) => ({
      pubkey: new PublicKey(meta.address),
      isSigner: isSignerRole(meta.role),
      isWritable: isWritableRole(meta.role),
    })),
    data: Buffer.from(instruction.data ?? new Uint8Array()),
  });
}

export function toWeb3JsInstructions(instructions: readonly Instruction[]): TransactionInstruction[] {
  return instructions.map(toWeb3JsInstruction);
}
