import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Docs" };

const CLIENT_SNIPPET = `import { createSolanaRpc, address } from "@solana/kit";
import {
  deriveVaultAddresses,
  fetchVault,
  fetchMaybeUserPosition,
  buildDepositInstruction,
  summarizePosition,
} from "@stablesave/client";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const { vault, reserve, position } = await deriveVaultAddresses({
  mint: address(USDC_MINT),
  riskProfile: 1, // balanced
  owner: address(wallet),
});

const vaultAccount = await fetchVault(rpc, vault);
const reserveBalance = await rpc.getTokenAccountBalance(reserve).send();

const ix = await buildDepositInstruction({
  vaultAddress: vault,
  vault: vaultAccount.data,
  reserveAmount: BigInt(reserveBalance.value.amount),
  owner: signer,            // kit TransactionSigner, or an address
  ownerToken: usdcAccount,
  amount: 10_000_000_000n,  // 10,000 USDC (6 decimals)
});`;

const INSTRUCTIONS = [
  ["initialize_vault", "Create a vault + reserve for a mint and risk profile. Upgrade authority only."],
  ["deposit", "Transfer USDC in and mint shares, with a minimum-shares slippage guard."],
  ["withdraw", "Instant withdrawal, capped per position and per vault in a rolling window."],
  ["request_withdrawal", "Lock shares for a timelocked withdrawal (for larger amounts)."],
  ["execute_withdrawal", "Pay out a request once its timelock has passed."],
  ["cancel_withdrawal", "Return locked shares to the position."],
  ["update_strategy", "Set protocol weights. ≤ 8 protocols, unique, summing to 100%."],
  ["update_limits", "Set deposit cap, minimum, instant threshold, window and timelock (bounded)."],
  ["pause / unpause", "Guardian or authority can pause; only the authority can unpause."],
  ["set_guardian, transfer_authority, accept_authority", "Role management with a two-step handover."],
];

export default function DocsPage() {
  return (
    <ProsePage
      eyebrow="Docs"
      title="Build on StableSave"
      intro="The repository is a monorepo: a Next.js app, an API, the Anchor vault program, a Codama-generated client, the risk engine and the protocol adapters."
    >
      <ProseSection title="Packages">
        <ul className="divide-y divide-line rounded-[20px] border border-line text-sm">
          {[
            ["apps/web", "This app (Next.js, Tailwind, Wallet Adapter)."],
            ["apps/api", "HTTP API serving opportunities, strategies and estimates."],
            ["programs/stablesave-vault", "Anchor program for the savings vault."],
            ["packages/client", "Codama-generated TypeScript client plus helpers."],
            ["packages/risk-engine", "calculateSafetyGrade(): A–D grades with reasons."],
            ["packages/protocol-adapters", "Kamino, MarginFi, Drift and Save adapters."],
            ["packages/core", "Shared types, earnings math, risk profiles, strategy config."],
            ["packages/ui", "Design-system primitives."],
          ].map(([name, body]) => (
            <li key={name} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:gap-4">
              <code className="w-56 shrink-0 font-mono text-[13px] text-fg">{name}</code>
              <span>{body}</span>
            </li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="Vault program instructions">
        <ul className="divide-y divide-line rounded-[20px] border border-line text-sm">
          {INSTRUCTIONS.map(([name, body]) => (
            <li key={name} className="flex flex-col gap-0.5 p-4">
              <code className="font-mono text-[13px] text-fg">{name}</code>
              <span>{body}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Every rule above is enforced by the program, not the frontend. PDAs: vault <code className="text-fg">[&quot;vault&quot;, mint, risk_profile]</code>,
          reserve <code className="text-fg">[&quot;reserve&quot;, vault]</code>, position{" "}
          <code className="text-fg">[&quot;position&quot;, vault, owner]</code>.
        </p>
      </ProseSection>

      <ProseSection title="Using the client">
        <pre className="overflow-x-auto rounded-[20px] border border-line bg-surface p-5 font-mono text-[12.5px] leading-relaxed text-fg">
          <code>{CLIENT_SNIPPET}</code>
        </pre>
        <p className="text-sm">
          With Wallet Adapter, convert with <code className="text-fg">toWeb3JsInstructions()</code> from{" "}
          <code className="text-fg">@stablesave/client/web3js</code> and send as a normal transaction. Regenerate the
          client after program changes with <code className="text-fg">pnpm idl:build && pnpm generate:client</code>.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
