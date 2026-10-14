"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { Badge, Button, Card, cn } from "@stablesave/ui";
import { ArrowUpRight, Check, Copy, LoaderCircle } from "lucide-react";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { useWalletDialog } from "@/components/wallet/wallet-providers";
import { blinkUrl, type ActionGetResponse, type LinkedAction } from "@/lib/actions/solana-actions";
import { CLUSTER_LABEL, explorerTxUrl } from "@/lib/env";
import { describeTxError, submitTransaction } from "@/lib/vault/onchain";

const ACTION_PATH = "/api/actions/deposit";

type Status =
  | { phase: "idle" }
  | { phase: "building" | "signing" }
  | { phase: "done"; signature: string; message?: string }
  | { phase: "error"; message: string };

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Renders the deposit Action the way a Blink client does: GET the metadata, show its buttons and
 * fields, POST the wallet address, then sign the transaction the Action returns. It calls the same
 * endpoint dial.to and wallets call, so it works wherever those clients don't show the Blink.
 */
export function BlinkPreview() {
  const env = useEnvironment();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { setOpen: openWalletDialog } = useWalletDialog();
  const [meta, setMeta] = React.useState<ActionGetResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<Status>({ phase: "idle" });
  const [origin, setOrigin] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setOrigin(window.location.origin);
    fetch(ACTION_PATH)
      .then(async (res) => {
        if (!res.ok) throw new Error(`The Action answered ${res.status}.`);
        const body = (await res.json()) as ActionGetResponse;
        setMeta(body);
        const defaults: Record<string, string> = {};
        for (const action of body.links?.actions ?? []) {
          for (const p of action.parameters ?? []) {
            const selected = p.options?.find((o) => o.selected) ?? p.options?.[0];
            if (selected) defaults[p.name] = selected.value;
          }
        }
        setValues(defaults);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const busy = status.phase === "building" || status.phase === "signing";

  async function run(action: LinkedAction) {
    if (!publicKey) {
      openWalletDialog(true);
      return;
    }
    let href = action.href;
    for (const p of action.parameters ?? []) {
      const value = (values[p.name] ?? "").trim();
      if (p.required && !value) {
        setStatus({ phase: "error", message: `Enter ${(p.label ?? p.name).toLowerCase()} first.` });
        return;
      }
      href = href.replace(`{${p.name}}`, encodeURIComponent(value));
    }
    setStatus({ phase: "building" });
    try {
      const res = await fetch(href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: publicKey.toBase58() }),
      });
      const body = (await res.json().catch(() => ({}))) as { transaction?: string; message?: string };
      if (!res.ok || !body.transaction) throw new Error(body.message ?? `The Action answered ${res.status}.`);
      const tx = Transaction.from(base64ToBytes(body.transaction));
      setStatus({ phase: "signing" });
      // Simulated on this cluster, signed by the wallet, sent by us (refreshes the blockhash too).
      const signature = await submitTransaction({ connection, sendTransaction, signTransaction }, tx);
      setStatus({ phase: "done", signature, message: body.message });
    } catch (error) {
      setStatus({ phase: "error", message: describeTxError(error) });
    }
  }

  const actions = meta?.links?.actions ?? [];
  const quick = actions.filter((a) => !a.parameters?.length);
  const custom = actions.filter((a) => a.parameters?.length);
  const share = origin ? blinkUrl(`${origin}${ACTION_PATH}`, env.cluster) : null;

  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(share, "_blank", "noopener");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        {meta ? (
          <>
            <div className="flex items-center justify-center bg-brand/[0.07] py-8">
              {/* The Action's own icon, as a Blink client shows it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={meta.icon} alt="" width={120} height={120} className="size-[120px] rounded-[28px]" />
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <span className="truncate">{origin ? new URL(origin).host : ""}</span>
                <Badge size="xs" tone="info">
                  {CLUSTER_LABEL[env.cluster]}
                </Badge>
              </div>
              <div>
                <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{meta.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{meta.description}</p>
              </div>

              {meta.disabled ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">{meta.error?.message ?? "This Action is turned off."}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {quick.map((a) => (
                      <Button key={a.href} variant="secondary" size="md" disabled={busy} onClick={() => void run(a)}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                  {custom.map((a) => (
                    <div key={a.href} className="flex flex-col gap-2">
                      {a.parameters!.map((p) =>
                        p.type === "select" ? (
                          <select
                            key={p.name}
                            aria-label={p.label ?? p.name}
                            value={values[p.name] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                            className="h-11 rounded-full border border-line bg-surface-2 px-4 text-sm text-fg outline-none focus-visible:border-brand/50"
                          >
                            {p.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            key={p.name}
                            aria-label={p.label ?? p.name}
                            placeholder={p.label ?? p.name}
                            inputMode={p.type === "number" ? "decimal" : undefined}
                            value={values[p.name] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                            className="h-11 rounded-full border border-line bg-surface-2 px-4 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:border-brand/50"
                          />
                        ),
                      )}
                      <Button variant="primary" size="md" disabled={busy} onClick={() => void run(a)}>
                        {a.label}
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {status.phase !== "idle" ? (
                <p
                  role="status"
                  className={cn(
                    "flex items-start gap-2 rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
                    status.phase === "error" ? "bg-danger/[0.08] text-danger" : status.phase === "done" ? "bg-positive/[0.08] text-positive" : "bg-surface-2 text-fg-muted",
                  )}
                >
                  {busy ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" /> : null}
                  {status.phase === "done" ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
                  <span>
                    {status.phase === "building" && "Building the transaction…"}
                    {status.phase === "signing" && `Approve it in your wallet, then it goes to ${CLUSTER_LABEL[env.cluster]}…`}
                    {status.phase === "error" && status.message}
                    {status.phase === "done" ? (
                      <>
                        {status.message ?? "Deposited."}{" "}
                        <a href={explorerTxUrl(status.signature, env.cluster)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          View on Explorer
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="p-6 text-sm text-fg-muted">{loadError ? `Couldn't load the Action: ${loadError}` : "Loading the Action…"}</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-medium">Share it</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          Blink clients (dial.to, wallets that read Solana Actions) render this same Action from a link. It isn&apos;t in
          the Blinks registry yet, so dial.to shows a warning first and X won&apos;t unfurl it. The wallet you open it with
          must be on {CLUSTER_LABEL[env.cluster]}.
        </p>
        <p className="mt-3 break-all rounded-2xl bg-surface-2 px-4 py-3 font-mono text-xs text-fg-muted">{origin ? `${origin}${ACTION_PATH}` : ACTION_PATH}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copy} disabled={!share}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy dial.to link"}
          </Button>
          {share ? (
            <Button asChild variant="tonal" size="sm">
              <a href={share} target="_blank" rel="noopener noreferrer">
                Open on dial.to
                <ArrowUpRight />
              </a>
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
