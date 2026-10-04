import Link from "next/link";

const LINKS = [
  { href: "/safety", label: "How we rate safety" },
  { href: "/data-sources", label: "Data sources" },
  { href: "/docs", label: "Docs" },
  { href: "/risks", label: "Risks" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-[880px] px-4 py-12 sm:px-6">
        <div className="max-w-[560px] space-y-2 text-[13px] leading-relaxed text-fg-muted">
          <p>StableSave helps you compare ways to earn on stablecoins. It isn&apos;t financial advice.</p>
          <p>DeFi assets aren&apos;t insured. You can lose some or all of what you deposit.</p>
          <p>Always verify the official protocol before depositing.</p>
        </div>
        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px]" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-fg-muted transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-10 text-xs text-fg-subtle">
          Built with <span aria-label="love">♥</span> for the stablecoin community
        </p>
      </div>
    </footer>
  );
}
