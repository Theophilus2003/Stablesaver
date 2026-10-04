import { GRADE_BANDS, GRADE_LABELS, GRADE_SUMMARIES, type Grade } from "@stablesave/core";
import {
  FACTORS,
  METHODOLOGY_VERSION,
  SAFETY_ASSESSMENT_LABEL,
  SAFETY_DISCLAIMER,
  describeCapRules,
} from "@stablesave/risk-engine";
import { GradeBadge } from "@stablesave/ui";
import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "How we rate safety" };

const FACTOR_COPY: Record<string, string> = {
  maturity: "How long it has been live. Time in production, through market stress, is the best test there is.",
  tvl: "How much is deposited. Bigger pools attract more scrutiny from security researchers.",
  liquidity: "How much you could withdraw right now, how much is lent out, and any unstaking wait.",
  smartContract: "Public audits, bug bounties, open source code, and who can upgrade the contracts.",
  complexity: "Plain lending is simpler than automated vaults; insurance-style positions can absorb losses.",
  incidents: "Past security incidents, how serious they were, whether users were made whole. Older ones count less.",
  yieldVolatility: "How much the rate moved over 30 days, and how much of it comes from token rewards.",
  oracle: "Whether it depends on price feeds, and whether it has backups if one feed is wrong.",
  concentration: "Whether a few large depositors, or a single collateral asset, dominate the pool.",
};


export default function SafetyPage() {
  const letters: Grade[] = ["A", "B", "C", "D"];
  return (
    <ProsePage
      eyebrow={SAFETY_ASSESSMENT_LABEL}
      title="How we rate safety"
      intro="Every option gets an A–D grade. It's our relative assessment of how much could go wrong, built from the data we have. It is an opinion, not a guarantee, and DeFi is never risk-free."
    >
      <ProseSection title="The grades">
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {letters.map((g, i) => {
            const min = Math.min(...GRADE_BANDS.filter((b) => b.grade === g).map((b) => b.min));
            const prev = letters[i - 1];
            const max = prev ? Math.min(...GRADE_BANDS.filter((b) => b.grade === prev).map((b) => b.min)) - 1 : 100;
            return (
              <li key={g} className="flex items-start gap-4 p-4">
                <GradeBadge grade={g} size="lg" />
                <div>
                  <p className="text-[15px] font-medium text-fg">
                    {GRADE_LABELS[g]}{" "}
                    <span className="font-normal tabular-nums text-fg-subtle">
                      · score {min}–{max}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">{GRADE_SUMMARIES[g]}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-sm">
          Plus and minus show where an option sits inside its letter (A−, B+, B−…). There is no A+: nothing in DeFi
          deserves it.
        </p>
      </ProseSection>

      <ProseSection title="What goes into the score">
        <p>Nine factors, each scored 0–100 and weighted:</p>
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {FACTORS.map((f) => (
            <li key={f.id} className="flex gap-4 p-4">
              <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-fg">{f.weight}%</span>
              <div>
                <p className="text-[15px] font-medium text-fg">{f.label}</p>
                <p className="mt-1 text-sm text-fg-muted">{FACTOR_COPY[f.id]}</p>
              </div>
            </li>
          ))}
        </ul>
        <p>
          A quarter of the final score comes from the weakest factor. One serious problem shouldn&apos;t hide behind
          several good averages.
        </p>
      </ProseSection>

      <ProseSection title="When data is missing">
        <p>
          Live data from DefiLlama covers rates, deposits, liquidity, rate history, listing dates, audits and price feeds.
          It doesn&apos;t cover bug bounties, who can upgrade the contracts, incident history or concentration. Those
          factors show as <span className="text-fg">not verified</span>, score conservatively, and are named in the
          grade&apos;s explanation. Missing data never makes an option look safer.
        </p>
      </ProseSection>

      <ProseSection title="Hard limits">
        <p>Some problems cap the grade no matter how good everything else looks:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {describeCapRules().map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="The StableSave Vault">
        <p>
          A vault strategy is graded from its parts: 70% the weighted average of its markets, 30% the riskiest one, minus
          a few points for the vault&apos;s own smart contract. Splitting money doesn&apos;t make risk disappear.
        </p>
      </ProseSection>

      <ProseSection title="What a grade isn't">
        <p>
          It isn&apos;t financial advice, an audit, or a promise. Inputs can be wrong or out of date, and new kinds of
          failure happen. {SAFETY_DISCLAIMER} Methodology version {METHODOLOGY_VERSION}.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
