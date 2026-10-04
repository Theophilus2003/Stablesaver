import type { NetworkId, ProtocolId, StableAsset } from "./types";

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  /** Solana is the only network StableSave supports today. */
  status: "supported" | "planned";
}

export const NETWORKS: Record<NetworkId, NetworkInfo> = {
  solana: { id: "solana", name: "Solana", status: "supported" },
  ethereum: { id: "ethereum", name: "Ethereum", status: "planned" },
  base: { id: "base", name: "Base", status: "planned" },
};

export const NETWORK_ORDER: NetworkId[] = ["solana", "ethereum", "base"];

export interface ProtocolInfo {
  id: ProtocolId;
  name: string;
  network: NetworkId;
  officialUrl: string;
  officialDomain: string;
  /** One-line, plain-English description. */
  tagline: string;
}

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

export const ASSET_INFO: Record<StableAsset, { symbol: StableAsset; name: string; issuer: string }> = {
  USDC: { symbol: "USDC", name: "USD Coin", issuer: "Circle" },
  USDT: { symbol: "USDT", name: "Tether USD", issuer: "Tether" },
};
