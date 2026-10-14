"use client";

import { looksLikeSolanaAddress, type StableAsset, type WalletStablecoins } from "@stablesave/core";
import { Button, cn } from "@stablesave/ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { LoaderCircle, ScanSearch, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { useWalletDialog } from "@/components/wallet/wallet-providers";
import { formatEarnings, formatUsd } from "@/lib/format";

type ScanState =
  | { status: "idle" }
  | { status: "loading"; address: string }
  | { status: "done"; wallet: WalletStablecoins }
  | { status: "error"; message: string };

export interface IdleMoneyProps {
  /** Best-fit yearly earnings for an amount, or null when nothing fits. */
  estimate: (amount: number, asset: StableAsset) => { net: number; protocolName: string } | null;
  /** Put an amount into the calculator. */
  onUse: (amount: number, asset: StableAsset) => void;
  className?: string;
}

/**
 * "Find my idle money": reads the USDC and USDT a Solana wallet holds on
 * mainnet (read-only) and shows what it could earn.
 */
export function IdleMoney({ estimate, onUse, className }: IdleMoneyProps) {
  const { publicKey } = useWallet();
  const { setOpen: openWalletDialog } = useWalletDialog();
  const connected = publicKey?.toBase58() ?? null;
  const [expanded, setExpanded] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [state, setState] = React.useState<ScanState>({ status: "idle" });
  // The connected wallet is checked once on its own; after that only when asked.
  const autoScanned = React.useRef<string | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);

  const scan = React.useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!looksLikeSolanaAddress(trimmed)) {
      setState({ status: "error", message: "That doesn't look like a Solana wallet address." });
      return;
    }
    setState({ status: "loading", address: trimmed });
    try {
      const res = await fetch(`/api/wallet/${encodeURIComponent(trimmed)}`);
      const body = (await res.json()) as WalletStablecoins | { error: string };
      if (!res.ok || "error" in body) throw new Error("error" in body ? body.error : "We couldn't read this wallet.");
      setState({ status: "done", wallet: body });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "We couldn't read this wallet." });
    }
  }, []);

  // A wallet connected while the panel is open gets checked straight away, once.
  React.useEffect(() => {
    if (expanded && connected && state.status === "idle" && autoScanned.current !== connected) {
      autoScanned.current = connected;
      void scan(connected);
    }
  }, [expanded, connected, state.status, scan]);

  if (!expanded) {
    return (
      <div className={cn("flex justify-center", className)}>
        <Button variant="tonal" size="sm" onClick={() => setExpanded(true)}>
          <ScanSearch />
          Find idle money in my wallet
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-[22px] border border-brand/20 bg-surface/80 p-4 backdrop-blur-sm sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-fg">Find idle money</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">USDC and USDT sitting in a Solana wallet earn nothing.</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            setExpanded(false);
            setState({ status: "idle" });
            autoScanned.current = null;
            setFocusInput(false);
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state.status === "done" ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
            <Result wallet={state.wallet} estimate={estimate} onUse={onUse} />
            <button
              type="button"
              onClick={() => {
                setInput("");
                setFocusInput(true);
                setState({ status: "idle" });
              }}
              className="mt-3 text-xs font-medium text-fg-muted underline decoration-line-strong underline-offset-2 hover:text-fg"
            >
              Check another wallet
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="ask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void scan(input);
            }}
          >
            {connected ? (
              <Button type="button" variant="primary" size="md" onClick={() => void scan(connected)} disabled={state.status === "loading"}>
                {state.status === "loading" ? <LoaderCircle className="animate-spin" /> : <Wallet />}
                Check my connected wallet
              </Button>
            ) : (
              <Button type="button" variant="primary" size="md" onClick={() => openWalletDialog(true)}>
                <Wallet />
                Connect wallet
              </Button>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="idle-address" className="sr-only">
                Solana wallet address
              </label>
              <input
                id="idle-address"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="or paste any Solana address"
                autoFocus={focusInput}
                autoComplete="off"
                spellCheck={false}
                className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 font-mono text-[13px] text-fg outline-none placeholder:font-sans placeholder:text-fg-subtle focus-visible:border-brand/50"
              />
              <Button type="submit" variant="secondary" size="md" disabled={state.status === "loading" || input.trim() === ""}>
                {state.status === "loading" && state.address === input.trim() ? <LoaderCircle className="animate-spin" /> : null}
                Check
              </Button>
            </div>
            {state.status === "error" ? <p className="text-xs text-danger">{state.message}</p> : null}
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
        Read-only: we look up public balances on Solana mainnet. Nothing to sign, nothing stored.
      </p>
    </motion.div>
  );
}

function Result({
  wallet,
  estimate,
  onUse,
}: {
  wallet: WalletStablecoins;
  estimate: IdleMoneyProps["estimate"];
  onUse: IdleMoneyProps["onUse"];
}) {
  const { balances, largest } = wallet;
  const amount = Math.floor(balances[largest]);
  if (wallet.totalUsd < 1) {
    return <p className="text-sm text-fg-muted">No USDC or USDT in this wallet on Solana.</p>;
  }
  const best = amount >= 1 ? estimate(amount, largest) : null;
  const held = (["USDC", "USDT"] as const)
    .filter((a) => balances[a] >= 0.01)
    .map((a) => `${formatUsd(balances[a], { decimals: balances[a] >= 10_000 || Number.isInteger(balances[a]) ? 0 : 2 })} ${a}`)
    .join(" and ");
  return (
    <div>
      <p className="text-sm text-fg-muted">
        This wallet holds <span className="font-semibold text-fg">{held}</span>, earning nothing.
      </p>
      {best ? (
        <p className="mt-1.5 text-[15px] text-fg">
          Put the {largest} to work: about <span className="font-semibold text-positive">{formatEarnings(best.net)} a year</span> on{" "}
          {best.protocolName}.
        </p>
      ) : null}
      {amount >= 1 ? (
        <Button variant="primary" size="sm" className="mt-3" onClick={() => onUse(amount, largest)}>
          Use {formatUsd(amount, { decimals: 0 })} {largest} in the calculator
        </Button>
      ) : null}
    </div>
  );
}
