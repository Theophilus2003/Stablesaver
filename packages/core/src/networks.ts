import type { NetworkId, ProtocolId, StableAsset } from "./types";

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  /** Badge colour. */
  color: string;
  /**
   * Rough cost of depositing and later withdrawing once (approval included on
   * EVM chains), in USD. An estimate for comparison, not a quote.
   */
  estimatedNetworkFeeUsd: number;
}

/** Fallback when a chain isn't in the table below. */
export const DEFAULT_NETWORK_FEE_USD = 1;

const KNOWN_NETWORKS: Record<string, Omit<NetworkInfo, "id">> = {
  solana: { name: "Solana", color: "#14f195", estimatedNetworkFeeUsd: 0.02 },
  ethereum: { name: "Ethereum", color: "#8a92b2", estimatedNetworkFeeUsd: 12 },
  arbitrum: { name: "Arbitrum", color: "#28a0f0", estimatedNetworkFeeUsd: 0.2 },
  base: { name: "Base", color: "#0052ff", estimatedNetworkFeeUsd: 0.1 },
  optimism: { name: "Optimism", color: "#ff0420", estimatedNetworkFeeUsd: 0.2 },
  "op-mainnet": { name: "OP Mainnet", color: "#ff0420", estimatedNetworkFeeUsd: 0.2 },
  polygon: { name: "Polygon", color: "#8247e5", estimatedNetworkFeeUsd: 0.05 },
  bsc: { name: "BSC", color: "#f0b90b", estimatedNetworkFeeUsd: 0.3 },
  avalanche: { name: "Avalanche", color: "#e84142", estimatedNetworkFeeUsd: 0.3 },
  plasma: { name: "Plasma", color: "#1fbf8f", estimatedNetworkFeeUsd: 0.02 },
  sonic: { name: "Sonic", color: "#e6e6e6", estimatedNetworkFeeUsd: 0.05 },
  gnosis: { name: "Gnosis", color: "#3e6957", estimatedNetworkFeeUsd: 0.02 },
  linea: { name: "Linea", color: "#61dfff", estimatedNetworkFeeUsd: 0.3 },
  scroll: { name: "Scroll", color: "#ffdbb0", estimatedNetworkFeeUsd: 0.3 },
  mantle: { name: "Mantle", color: "#c4c4c4", estimatedNetworkFeeUsd: 0.1 },
  unichain: { name: "Unichain", color: "#f50db4", estimatedNetworkFeeUsd: 0.1 },
  sui: { name: "Sui", color: "#4da2ff", estimatedNetworkFeeUsd: 0.05 },
  aptos: { name: "Aptos", color: "#d9d9d9", estimatedNetworkFeeUsd: 0.05 },
  tron: { name: "Tron", color: "#ff060a", estimatedNetworkFeeUsd: 5 },
};

/** "Hyperliquid L1" → "hyperliquid-l1" */
export function networkIdFromName(name: string): NetworkId {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getNetwork(id: NetworkId, displayName?: string): NetworkInfo {
  const known = KNOWN_NETWORKS[id];
  if (known) return { id, ...known };
  return { id, name: displayName ?? id, color: "#8b8b93", estimatedNetworkFeeUsd: DEFAULT_NETWORK_FEE_USD };
}

export interface ProtocolInfo {
  id: ProtocolId;
  name: string;
  network: NetworkId;
  officialUrl: string;
  officialDomain: string;
  /** One-line, plain-English description. */
  tagline: string;
}

/** Curated details for the protocols the StableSave Vault can use. */
export const PROTOCOLS: Record<ProtocolId, ProtocolInfo> = {
  kamino: {
    id: "kamino",
    name: "Kamino",
    network: "solana",
    officialUrl: "https://app.kamino.finance",
    officialDomain: "app.kamino.finance",
    tagline: "Lending markets and automated vaults on Solana.",
  },
  marginfi: {
    id: "marginfi",
    name: "MarginFi",
    network: "solana",
    officialUrl: "https://app.marginfi.com",
    officialDomain: "app.marginfi.com",
    tagline: "Pooled lending and borrowing on Solana.",
  },
  drift: {
    id: "drift",
    name: "Drift",
    network: "solana",
    officialUrl: "https://app.drift.trade",
    officialDomain: "app.drift.trade",
    tagline: "Trading exchange with spot lending and an insurance fund.",
  },
  save: {
    id: "save",
    name: "Save",
    network: "solana",
    officialUrl: "https://save.finance",
    officialDomain: "save.finance",
    tagline: "One of Solana's longest-running lending protocols (formerly Solend).",
  },
};

export function isVaultProtocol(id: string): id is ProtocolId {
  return id in PROTOCOLS;
}

export const ASSET_INFO: Record<StableAsset, { symbol: StableAsset; name: string; issuer: string }> = {
  USDC: { symbol: "USDC", name: "USD Coin", issuer: "Circle" },
  USDT: { symbol: "USDT", name: "Tether USD", issuer: "Tether" },
};
