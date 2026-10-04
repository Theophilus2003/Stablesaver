import { cn } from "@stablesave/ui";
import Link from "next/link";

/** Three stacked coins, smallest on top — savings building up. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden fill="currentColor">
      <rect x="3" y="14.5" width="18" height="6" rx="3" opacity="0.32" />
      <rect x="5" y="9" width="14" height="6" rx="3" opacity="0.62" />
      <rect x="7" y="3.5" width="10" height="6" rx="3" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-fg/40", className)}>
      <LogoMark className="size-[22px] text-fg transition-transform duration-300 group-hover:-translate-y-px" />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">StableSave</span>
    </Link>
  );
}
