/** Shared helpers for the operator scripts (Node only). */
import { createHash } from "node:crypto";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createDefaultRpcTransport,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Encoder,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
  type Instruction,
  type KeyPairSigner,
  type Rpc,
  type RpcTransport,
  type SolanaRpcApi,
} from "@solana/kit";

export interface Connection {
  rpc: Rpc<SolanaRpcApi>;
  sendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory>;
}

/** WebSocket URL for an RPC URL. A local validator serves it on the next port (8899 → 8900). */
export function websocketUrl(rpcUrl: string): string {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (url.port) url.port = String(Number(url.port) + 1);
  return url.toString();
}

/** Waits before each retry. Public devnet answers 429 when a script sends requests in quick succession. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/**
 * Retries a request the RPC turned away (rate limit or a brief outage), honouring
 * Retry-After. Safe for sendTransaction too: resending the same signed
 * transaction can't make it land twice.
 */
export function withRetries(transport: RpcTransport, delays: readonly number[] = RETRY_DELAYS_MS): RpcTransport {
  return (async (config: Parameters<RpcTransport>[0]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await transport(config);
      } catch (error) {
        const delay = delays[attempt];
        if (delay === undefined || !isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) throw error;
        const { statusCode, headers } = error.context;
        if (!RETRYABLE_STATUS.has(statusCode)) throw error;
        const retryAfter = Number(headers?.get("retry-after")) * 1_000;
        const wait = retryAfter > 0 ? Math.min(retryAfter, 60_000) : delay;
        console.warn(`RPC busy (HTTP ${statusCode}), retrying in ${wait / 1_000}s`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }) as RpcTransport;
}

export function connect(rpcUrl: string): Connection {
  const rpc = createSolanaRpcFromTransport(withRetries(createDefaultRpcTransport({ url: rpcUrl })));
  const rpcSubscriptions = createSolanaRpcSubscriptions(websocketUrl(rpcUrl));
  return { rpc, sendAndConfirm: sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions }) };
}

/**
 * The 64 secret-key bytes from either a solana-keygen JSON array ("[12,34,…]")
 * or a base58 private key as exported by Phantom or Solflare.
 */
export function keypairBytes(text: string): Uint8Array {
  const trimmed = text.trim();
  const bytes = trimmed.startsWith("[")
    ? Uint8Array.from(JSON.parse(trimmed) as number[])
    : Uint8Array.from(getBase58Encoder().encode(trimmed));
  if (bytes.length !== 64) throw new Error(`Expected a 64-byte secret key, got ${bytes.length} bytes.`);
  return bytes;
}

export function loadKeypairSigner(text: string): Promise<KeyPairSigner> {
  return createKeyPairSignerFromBytes(keypairBytes(text));
}

/**
 * A keypair derived from the deployer's secret and a label. The same deployer
 * key always gives the same program id and test mint, and nobody without that
 * key can derive them.
 */
export async function deriveKeypair(
  deployerSecret: Uint8Array,
  label: string,
): Promise<{ signer: KeyPairSigner; solanaCliBytes: Uint8Array }> {
  const seed = createHash("sha256").update(`stablesave/${label}/`).update(deployerSecret.subarray(0, 32)).digest();
  const signer = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(seed));
  const solanaCliBytes = new Uint8Array(64);
  solanaCliBytes.set(seed, 0);
  solanaCliBytes.set(getAddressEncoder().encode(signer.address), 32);
  return { signer, solanaCliBytes };
}

/** Sign (with every signer attached to the instructions) and confirm one transaction. */
export async function sendInstructions(
  connection: Connection,
  feePayer: KeyPairSigner,
  instructions: Instruction[],
): Promise<string> {
  const { value: blockhash } = await connection.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  await connection.sendAndConfirm(signed as Parameters<Connection["sendAndConfirm"]>[0], { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}
