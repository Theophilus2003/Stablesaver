import { Eyebrow, cn } from "@stablesave/ui";
import * as React from "react";

/** Simple long-form layout for the info pages. */
export function ProsePage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[680px] px-4 pt-12 sm:px-6 sm:pt-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 text-[36px] font-semibold leading-[1.08] tracking-[-0.035em] text-balance sm:text-[44px]">{title}</h1>
      {intro ? <p className="mt-4 text-base leading-relaxed text-fg-muted">{intro}</p> : null}
      <div className="mt-10 flex flex-col gap-10">{children}</div>
    </article>
  );
}

export function ProseSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}
