import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Risks" };

export default function RisksPage() {
  return (
    <ProsePage
      eyebrow="Risks"
      title="What could go wrong"
      intro="Earning yield on stablecoins means lending them out or putting them to work in software. That carries real risk. You can lose some or all of what you deposit."
    >
      <ProseSection title="DeFi isn't a bank">
        <p>
          There&apos;s no deposit insurance and nobody guaranteeing your balance. If a protocol fails, there may be no
          one to get your money back from.
        </p>
      </ProseSection>
      <ProseSection title="Smart contract risk">
        <p>
          Protocols are code. Bugs have drained well-audited protocols before. Audits and bug bounties lower the odds;
          they don&apos;t remove them.
        </p>
      </ProseSection>
      <ProseSection title="Stablecoin risk">
        <p>
          USDC and USDT are designed to stay around $1, backed by their issuers&apos; reserves. If an issuer runs into
          trouble or an asset is frozen, a stablecoin can trade below $1.
        </p>
      </ProseSection>
      <ProseSection title="Liquidity risk">
        <p>
          In a lending market, most deposits are lent out. If many people withdraw at once, you may have to wait until
          borrowers repay. Some products, like insurance funds, have a fixed unstaking wait.
        </p>
      </ProseSection>
      <ProseSection title="Price feed (oracle) risk">
        <p>
          Lending markets rely on price feeds to know when loans are under-collateralised. A wrong or manipulated price
          can leave bad debt that depositors end up absorbing.
        </p>
      </ProseSection>
      <ProseSection title="Rates change">
        <p>
          The rate you see is today&apos;s. It moves with demand, and token rewards can stop at any time. Our yearly
          figures are estimates, not promises.
        </p>
      </ProseSection>
      <ProseSection title="StableSave's own risks">
        <p>
          When you deposit directly, StableSave isn&apos;t involved: we link to the official app and never hold your
          funds. When you use the StableSave Vault, its smart contract is an extra layer that could fail. It isn&apos;t
          audited yet. Its safety controls (withdrawal limits, timelocks, emergency pause) reduce some risks, and an
          emergency pause can also delay withdrawals.
        </p>
      </ProseSection>
      <ProseSection title="Phishing">
        <p>
          Always check you&apos;re on the official site before connecting a wallet. StableSave will never ask for your seed
          phrase.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
