import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { HeroBackdrop } from "@/components/brand/hero-backdrop";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppProviders } from "@/components/providers/app-providers";
import { getDataMode, getPublicEnv } from "@/lib/env";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StableSave — See what your stablecoins could earn",
    template: "%s · StableSave",
  },
  description:
    "Compare ways to earn on idle USDC and USDT, across networks. Estimated yearly earnings after fees, an A–D safety grade, and where your money goes.",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#070a09",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const environment = { ...getPublicEnv(), dataMode: getDataMode() };
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <AppProviders environment={environment}>
          <SiteHeader />
          <main className="relative isolate">
            <HeroBackdrop />
            {children}
          </main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
