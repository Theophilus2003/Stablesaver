import type { SolanaCluster } from "@stablesave/core";

/**
 * Solana Actions (Blinks) plumbing: CORS headers and response shapes from the
 * Actions spec, so wallets and Blink clients (dial.to, Phantom, X) can call us.
 */

/** CAIP-2 chain ids Blink clients expect in X-Blockchain-Ids. */
export const BLOCKCHAIN_IDS: Record<SolanaCluster, string> = {
  "mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  localnet: "solana:localnet",
};

export const ACTION_VERSION = "2.4";

export function actionHeaders(cluster: SolanaCluster): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": ACTION_VERSION,
    "X-Blockchain-Ids": BLOCKCHAIN_IDS[cluster],
    "Content-Type": "application/json",
  };
}

export interface ActionParameter {
  type?: "text" | "number" | "select" | "radio";
  name: string;
  label?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string; selected?: boolean }>;
}

export interface LinkedAction {
  type: "transaction" | "external-link";
  href: string;
  label: string;
  parameters?: ActionParameter[];
}

export interface ActionGetResponse {
  type: "action";
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: { actions: LinkedAction[] };
  error?: { message: string };
}

export interface ActionPostResponse {
  type: "transaction";
  /** Base64 serialized, unsigned transaction. */
  transaction: string;
  message?: string;
}

/** Link that opens an Action as a Blink on dial.to. */
export function blinkUrl(actionUrl: string, cluster: SolanaCluster): string {
  const params = new URLSearchParams({ action: `solana-action:${actionUrl}` });
  if (cluster !== "mainnet-beta") params.set("cluster", cluster);
  return `https://dial.to/?${params.toString()}`;
}
