"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Protocol logo (hot-linked from the data provider, never bundled) with a
 * monogram fallback, plus an optional network icon in the corner.
 */
const PROTOCOL_TINTS: Record<string, { bg: string; fg: string }> = {
  kamino: { bg: "#1b2a3d", fg: "#8fb8ff" },
  marginfi: { bg: "#2a2a2a", fg: "#e8e8e8" },
  drift: { bg: "#2a2140", fg: "#c4a8ff" },
  save: { bg: "#1d2f27", fg: "#8fe0b6" },
  stablesave: { bg: "#f2f2f0", fg: "#0b0b0c" },
};

const SIZES = {
  sm: { box: "size-7 text-[11px]", badge: "size-3.5 -right-1 -bottom-0.5 ring-[1.5px]" },
  md: { box: "size-10 text-[15px]", badge: "size-[18px] -right-1 -bottom-0.5 ring-2" },
  lg: { box: "size-12 text-base", badge: "size-5 -right-1 -bottom-0.5 ring-2" },
} as const;

export interface NetworkBadge {
  name: string;
  /** Shown when no icon loads. */
  color: string;
  /** Icon candidates, best first. */
  iconUrls?: readonly string[];
}

/**
 * Tries each URL in turn and reports when none loaded. Keeps the index per
 * list, so a re-render with the same URLs doesn't retry broken ones.
 */
function useFirstLoading(urls: readonly string[]): {
  src: string | null;
  onError: () => void;
  ref: React.RefCallback<HTMLImageElement>;
} {
  const key = urls.join("|");
  const [state, setState] = React.useState({ key, index: 0 });
  const index = state.key === key ? state.index : 0;
  const onError = React.useCallback(() => setState({ key, index: index + 1 }), [key, index]);
  // An image that failed before hydration never fires onError for React, so check on mount.
  const ref = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) img.decode().catch(onError);
    },
    [onError],
  );
  return { src: urls[index] ?? null, onError, ref };
}

/** A network's icon in a circle, falling back to its colour. */
export function NetworkIcon({ network, className }: { network: NetworkBadge; className?: string }) {
  const { src, onError, ref } = useFirstLoading(network.iconUrls ?? []);
  return (
    <span
      title={network.name}
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
      style={{ backgroundColor: src ? undefined : network.color }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={ref} src={src} alt="" decoding="async" referrerPolicy="no-referrer" onError={onError} className="size-full object-cover" />
      ) : null}
    </span>
  );
}

export function ProtocolMark({
  protocolId,
  name,
  logoUrl,
  network,
  size = "md",
  className,
}: {
  protocolId: string;
  name: string;
  /** Logo URL, or candidates tried in order. */
  logoUrl?: string | readonly string[] | null;
  /** Shows the network's icon in the corner. */
  network?: NetworkBadge | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const urls = React.useMemo(
    () => (Array.isArray(logoUrl) ? logoUrl : logoUrl ? [logoUrl as string] : []),
    [logoUrl],
  );
  const { src, onError, ref } = useFirstLoading(urls);
  const tint = PROTOCOL_TINTS[protocolId] ?? { bg: "#222", fg: "#ddd" };
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ring-1 ring-inset ring-white/8",
          SIZES[size].box,
        )}
        style={src ? { backgroundColor: "#1a1a1c" } : { backgroundColor: tint.bg, color: tint.fg }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={ref}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={onError}
            className="size-full object-cover"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      {network ? <NetworkIcon network={network} className={cn("absolute ring-surface", SIZES[size].badge)} /> : null}
    </span>
  );
}

export const PROTOCOL_COLORS: Record<string, string> = {
  kamino: "#8fb8ff",
  marginfi: "#d6d6d6",
  drift: "#c4a8ff",
  save: "#8fe0b6",
};
