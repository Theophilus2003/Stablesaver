"use client";

import { Button } from "@stablesave/ui";
import { Check, Share2 } from "lucide-react";
import * as React from "react";

/**
 * Shares the current page URL. The URL carries amount, asset and risk, and the
 * page's preview image (/api/og) shows the matching estimate.
 */
export function ShareEstimate({ className }: { className?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function share() {
    const url = window.location.href;
    // Phones get the native share sheet; desktops copy the link.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "StableSave", text: "See what your stablecoins could earn", url });
      } catch {
        // Closing the share sheet isn't an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  }

  return (
    <Button variant="tonal" size="sm" onClick={share} className={className} aria-live="polite">
      {copied ? <Check /> : <Share2 />}
      {copied ? "Link copied" : "Share my estimate"}
    </Button>
  );
}
