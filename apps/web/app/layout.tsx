import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppProviders } from "@/components/providers/app-providers";
import { getDataMode, getPublicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StableSave — See what your stablecoins could earn",
    template: "%s · StableSave",
  },
  description:
    "Compare ways to earn on idle USDC and USDT, across networks. Estimated yearly earnings after fees, an A–D safety grade, and where your money goes.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const environment = { ...getPublicEnv(), dataMode: getDataMode() };
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <AppProviders environment={environment}>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
