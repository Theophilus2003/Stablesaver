"use client";

import { Button, cn } from "@stablesave/ui";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { useOnboarding } from "@/components/onboarding/onboarding";
import { ConnectButton } from "@/components/wallet/connect-button";
import { EnvBadges } from "./env-badges";

const NAV = [
  { href: "/", label: "Save" },
  { href: "/vault", label: "Vault" },
  { href: "/safety", label: "How we rate" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/options") : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = React.useState(false);
  const onboarding = useOnboarding();

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 bg-canvas/[0.94] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                isActive(pathname, item.href) ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={onboarding.show}
            className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            How it works
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <EnvBadges />
          <ConnectButton className="hidden md:inline-flex" />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <div className="hairline-solana h-px w-full opacity-60" />

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full border-b border-line bg-canvas/95 backdrop-blur-xl md:hidden"
          >
            <nav className="mx-auto flex max-w-[1120px] flex-col gap-1 px-4 py-4" aria-label="Mobile">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-base",
                    isActive(pathname, item.href) ? "bg-surface-2 text-fg" : "text-fg-muted",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onboarding.show();
                }}
                className="rounded-2xl px-4 py-3 text-left text-base text-fg-muted"
              >
                How it works
              </button>
              <ConnectButton size="lg" className="mt-2 w-full" />
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
