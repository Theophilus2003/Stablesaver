import type { DataMode, SolanaCluster } from "@stablesave/core";

/**
 * Runtime configuration. Three things are kept visibly separate in the UI:
 *  - live market data (DefiLlama) vs DEMO DATA (server-side `STABLESAVE_DATA_MODE`)
 *  - which Solana cluster the wallet + vault use (DEVNET / MAINNET)
 *  - whether the vault program is actually deployed (otherwise: simulated preview)
 */
export interface PublicEnv {
  cluster: SolanaCluster;
  rpcUrl: string;
  vaultProgramId: string | null;
  vaultMint: string | null;
  vaultDeployed: boolean;
}

const DEFAULT_RPC: Record<SolanaCluster, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function parseCluster(value: string | undefined): SolanaCluster {
  return value === "mainnet-beta" || value === "localnet" ? value : "devnet";
}

export function getPublicEnv(): PublicEnv {
  const cluster = parseCluster(process.env.NEXT_PUBLIC_SOLANA_CLUSTER);
  const vaultProgramId = process.env.NEXT_PUBLIC_STABLESAVE_VAULT_PROGRAM_ID || null;
  const vaultMint = process.env.NEXT_PUBLIC_STABLESAVE_VAULT_MINT || null;
  return {
    cluster,
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC[cluster],
    vaultProgramId,
    vaultMint,
    vaultDeployed: Boolean(vaultProgramId && vaultMint),
  };
}

/**
 * Server only. Live DefiLlama data by default; `STABLESAVE_DATA_MODE=demo`
 * switches to the labelled demo fixtures (handy offline).
 */
export function getDataMode(): DataMode {
  return process.env.STABLESAVE_DATA_MODE === "demo" ? "demo" : "live";
}

export const CLUSTER_LABEL: Record<SolanaCluster, string> = {
  localnet: "Localnet",
  devnet: "Devnet",
  "mainnet-beta": "Mainnet",
};

export function explorerTxUrl(signature: string, cluster: SolanaCluster): string {
  const suffix = cluster === "mainnet-beta" ? "" : cluster === "devnet" ? "?cluster=devnet" : "?cluster=custom";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}
