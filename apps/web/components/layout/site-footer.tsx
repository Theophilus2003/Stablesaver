import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "/safety", label: "How we rate safety" },
  { href: "/data-sources", label: "Data sources" },
  { href: "/docs", label: "Docs" },
  { href: "/risks", label: "Risks" },
];

export function SiteFooter() {
  return (
    <footer className="relative isolate mt-24 overflow-hidden">
      <div className="hairline-brand h-px w-full opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-72 left-1/2 -z-10 h-[420px] w-[900px] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(61_220_151/0.12),transparent)]"
      />
      <div className="mx-auto max-w-[880px] px-4 py-12 sm:px-6">
        <Logo />
        <div className="mt-5 max-w-[560px] space-y-2 text-[13px] leading-relaxed text-fg-muted">
          <p>StableSave helps you compare ways to earn on stablecoins. It isn&apos;t financial advice.</p>
          <p>DeFi assets aren&apos;t insured. You can lose some or all of what you deposit.</p>
          <p>Always verify the official protocol before depositing.</p>
        </div>
        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px]" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-fg-muted transition-colors hover:text-brand">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-10 text-xs text-fg-subtle">
          Built with <span aria-label="love" className="text-brand">♥</span> for the stablecoin community
        </p>
      </div>
    </footer>
  );
}
