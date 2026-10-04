import * as React from "react";
import { cn } from "./cn";

/**
 * Small monogram instead of third-party logos: recognisable, quiet, and no
 * trademark artwork bundled with the app.
 */
const PROTOCOL_TINTS: Record<string, { bg: string; fg: string }> = {
  kamino: { bg: "#1b2a3d", fg: "#8fb8ff" },
  marginfi: { bg: "#2a2a2a", fg: "#e8e8e8" },
  drift: { bg: "#2a2140", fg: "#c4a8ff" },
  save: { bg: "#1d2f27", fg: "#8fe0b6" },
  stablesave: { bg: "#f2f2f0", fg: "#0b0b0c" },
};

const SIZES = {
  sm: "size-7 rounded-[9px] text-[11px]",
  md: "size-9 rounded-[11px] text-[13px]",
  lg: "size-12 rounded-[14px] text-base",
} as const;

export function ProtocolMark({
  protocolId,
  name,
  size = "md",
  className,
}: {
  protocolId: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const tint = PROTOCOL_TINTS[protocolId] ?? { bg: "#222", fg: "#ddd" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold tracking-tight ring-1 ring-inset ring-white/8",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export const PROTOCOL_COLORS: Record<string, string> = {
  kamino: "#8fb8ff",
  marginfi: "#d6d6d6",
  drift: "#c4a8ff",
  save: "#8fe0b6",
};
