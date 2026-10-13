import type { NetworkId, ProtocolId, StableAsset } from "./types";

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  /** Badge colour, also the fallback when there's no icon. */
  color: string;
  /** Bundled icon file name (web app: /networks/<icon>.svg), when there is one. */
  icon: string | null;
  /**
   * Rough cost of depositing and later withdrawing once (approval included on
   * EVM chains), in USD. An estimate for comparison, not a quote.
   */
  estimatedNetworkFeeUsd: number;
}

/** Fallback when a chain isn't in the table below. */
export const DEFAULT_NETWORK_FEE_USD = 1;

const KNOWN_NETWORKS: Record<string, Omit<NetworkInfo, "id" | "icon">> = {
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

/**
 * Network id (DefiLlama chain name, slugged) → bundled icon. Icons from
 * web3icons (MIT); chains not listed fall back to DefiLlama's icon, then the colour.
 */
export const NETWORK_ICONS: Record<NetworkId, string> = {
  abstract: "abstract",
  algorand: "algorand",
  apechain: "apechain",
  aptos: "aptos",
  arbitrum: "arbitrum-one",
  "arbitrum-nova": "arbitrum-nova",
  astar: "astar",
  aurora: "aurora",
  avalanche: "avalanche",
  base: "base",
  berachain: "berachain",
  bsc: "binance-smart-chain",
  bitcoin: "bitcoin",
  blast: "blast",
  bob: "bob",
  cardano: "cardano",
  celo: "celo",
  conflux: "conflux",
  corn: "corn",
  cronos: "cronos",
  ethereum: "ethereum",
  etherlink: "etherlink",
  fantom: "fantom",
  filecoin: "filecoin",
  flare: "flare",
  fraxtal: "fraxtal",
  fuse: "fuse",
  gnosis: "gnosis",
  xdai: "gnosis",
  gravity: "gravity",
  harmony: "harmony",
  hemi: "hemi",
  "hyperliquid-l1": "hyper-evm",
  hyperevm: "hyper-evm",
  "immutable-zkevm": "immutable",
  injective: "injective",
  ink: "ink",
  iotex: "iotex",
  kaia: "kaia",
  klaytn: "kaia",
  katana: "katana",
  kava: "kava",
  lens: "lens",
  linea: "linea",
  lisk: "lisk",
  manta: "manta-pacific",
  mantle: "mantle",
  megaeth: "mega-eth",
  metis: "metis-andromeda",
  mode: "mode",
  monad: "monad",
  moonbeam: "moonbeam",
  movement: "movement",
  multiversx: "multiversx",
  near: "near-protocol",
  optimism: "optimism",
  "op-mainnet": "optimism",
  osmosis: "osmosis",
  plasma: "plasma",
  plume: "plume",
  "plume-mainnet": "plume",
  polkadot: "polkadot",
  polygon: "polygon",
  "polygon-zkevm": "polygon-zkevm",
  ronin: "ronin",
  rootstock: "rootstock",
  scroll: "scroll",
  sei: "sei-network",
  solana: "solana",
  soneium: "soneium",
  sonic: "sonic",
  stable: "stable",
  starknet: "starknet",
  stellar: "stellar",
  sui: "sui",
  swellchain: "swell",
  taiko: "taiko",
  telos: "telos",
  ton: "ton",
  tron: "tron",
  unichain: "unichain",
  vana: "vana",
  "world-chain": "world",
  "x-layer": "x-layer",
  xdc: "xdc",
  "zksync-era": "zksync",
  zora: "zora",
};

export function getNetwork(id: NetworkId, displayName?: string): NetworkInfo {
  const icon = NETWORK_ICONS[id] ?? null;
  const known = KNOWN_NETWORKS[id];
  if (known) return { id, ...known, icon };
  return { id, name: displayName ?? id, color: "#8b8b93", icon, estimatedNetworkFeeUsd: DEFAULT_NETWORK_FEE_USD };
}

export interface ProtocolInfo {
  id: ProtocolId;
  name: string;
  network: NetworkId;
  officialUrl: string;
  officialDomain: string;
  /** One-line, plain-English description. */
  tagline: string;
  /** Logo candidates on DefiLlama's icon CDN, best first. */
  logoUrls: string[];
}

/**
 * A protocol's logo on DefiLlama's icon CDN, by DefiLlama slug ("aave-v3").
 * Hot-linked, so the UI keeps a monogram fallback for when it doesn't load.
 */
export function defiLlamaIconUrl(slug: string): string {
  return `https://icons.llamao.fi/icons/protocols/${encodeURIComponent(slug)}?w=96&h=96`;
}

/** A chain's icon on DefiLlama's icon CDN, by DefiLlama chain name ("Hyperliquid L1"). */
export function defiLlamaChainIconUrl(chainName: string): string {
  return `https://icons.llamao.fi/icons/chains/rsz_${encodeURIComponent(chainName.toLowerCase())}?w=48&h=48`;
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
    logoUrls: [defiLlamaIconUrl("kamino-lend"), defiLlamaIconUrl("kamino")],
  },
  marginfi: {
    id: "marginfi",
    name: "MarginFi",
    network: "solana",
    officialUrl: "https://app.marginfi.com",
    officialDomain: "app.marginfi.com",
    tagline: "Pooled lending and borrowing on Solana.",
    logoUrls: [defiLlamaIconUrl("marginfi-lending"), defiLlamaIconUrl("marginfi")],
  },
  drift: {
    id: "drift",
    name: "Drift",
    network: "solana",
    officialUrl: "https://app.drift.trade",
    officialDomain: "app.drift.trade",
    tagline: "Trading exchange with spot lending and an insurance fund.",
    logoUrls: [defiLlamaIconUrl("drift-trade"), defiLlamaIconUrl("drift")],
  },
  save: {
    id: "save",
    name: "Save",
    network: "solana",
    officialUrl: "https://save.finance",
    officialDomain: "save.finance",
    tagline: "One of Solana's longest-running lending protocols (formerly Solend).",
    logoUrls: [defiLlamaIconUrl("save"), defiLlamaIconUrl("solend")],
  },
};

export function isVaultProtocol(id: string): id is ProtocolId {
  return id in PROTOCOLS;
}

export const ASSET_INFO: Record<StableAsset, { symbol: StableAsset; name: string; issuer: string }> = {
  USDC: { symbol: "USDC", name: "USD Coin", issuer: "Circle" },
  USDT: { symbol: "USDT", name: "Tether USD", issuer: "Tether" },
};
