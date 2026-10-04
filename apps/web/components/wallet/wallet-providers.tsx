"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { WalletDialog } from "./wallet-dialog";

interface WalletDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const WalletDialogContext = React.createContext<WalletDialogState>({ open: false, setOpen: () => {} });

export function useWalletDialog() {
  return React.useContext(WalletDialogContext);
}

/**
 * Solana Wallet Adapter. Wallets are discovered through the Wallet Standard
 * (Phantom, Solflare, Backpack, …), so no adapter list is bundled.
 */
export function WalletProviders({ children }: { children: React.ReactNode }) {
  const { rpcUrl } = useEnvironment();
  const [open, setOpen] = React.useState(false);
  const wallets = React.useMemo(() => [], []);
  const onError = React.useCallback((error: WalletError) => {
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={rpcUrl} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletDialogContext.Provider value={{ open, setOpen }}>
          {children}
          <WalletDialog open={open} onOpenChange={setOpen} />
        </WalletDialogContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
