import {
  PROTOCOLS,
  defiLlamaChainIconUrl,
  defiLlamaIconUrl,
  isVaultProtocol,
  type NetworkInfo,
} from "@stablesave/core";
import type { NetworkBadge } from "@stablesave/ui";

/** A network for logo badges and chips: the bundled icon, then DefiLlama's, then its colour. */
export function networkBadge(network: NetworkInfo): NetworkBadge {
  const urls = network.icon ? [`/networks/${network.icon}.svg`] : [];
  urls.push(defiLlamaChainIconUrl(network.name));
  return { name: network.name, color: network.color, iconUrls: urls };
}

/** Logo candidates for a protocol: the data source's logo, then DefiLlama's icon CDN. */
export function protocolLogoUrls(protocolId: string, logo: string | null | undefined): string[] {
  const urls = logo ? [logo] : [];
  if (isVaultProtocol(protocolId)) urls.push(...PROTOCOLS[protocolId].logoUrls);
  else urls.push(defiLlamaIconUrl(protocolId));
  return [...new Set(urls)];
}
