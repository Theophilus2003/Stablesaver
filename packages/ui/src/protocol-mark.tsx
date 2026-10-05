"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Protocol logo (hot-linked from the data provider, never bundled) with a
 * monogram fallback, plus an optional network badge in the corner.
 */
const PROTOCOL_TINTS: Record<string, { bg: string; fg: string }> = {
  kamino: { bg: "#1b2a3d", fg: "#8fb8ff" },
  marginfi: { bg: "#2a2a2a", fg: "#e8e8e8" },
  drift: { bg: "#2a2140", fg: "#c4a8ff" },
  save: { bg: "#1d2f27", fg: "#8fe0b6" },
  stablesave: { bg: "#f2f2f0", fg: "#0b0b0c" },
};

const SIZES = {
  sm: { box: "size-7 rounded-[9px] text-[11px]", badge: "size-2.5 -right-0.5 -bottom-0.5" },
  md: { box: "size-9 rounded-[11px] text-[13px]", badge: "size-3 -right-0.5 -bottom-0.5" },
  lg: { box: "size-12 rounded-[14px] text-base", badge: "size-3.5 -right-0.5 -bottom-0.5" },
} as const;

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
  logoUrl?: string | null;
  /** Shows a coloured dot for the network in the corner. */
  network?: { name: string; color: string } | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const tint = PROTOCOL_TINTS[protocolId] ?? { bg: "#222", fg: "#ddd" };
  const showLogo = Boolean(logoUrl) && !failed;
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden font-semibold tracking-tight ring-1 ring-inset ring-white/8",
          SIZES[size].box,
        )}
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      {network ? (
        <span
          title={network.name}
          className={cn("absolute rounded-full ring-2 ring-surface", SIZES[size].badge)}
          style={{ backgroundColor: network.color }}
        />
      ) : null}
    </span>
  );
}

export const PROTOCOL_COLORS: Record<string, string> = {
  kamino: "#8fb8ff",
  marginfi: "#d6d6d6",
  drift: "#c4a8ff",
  save: "#8fe0b6",
};
