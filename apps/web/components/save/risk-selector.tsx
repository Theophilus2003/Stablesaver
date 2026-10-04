"use client";

import { RISK_PROFILE_IDS, RISK_PROFILES, type RiskProfile } from "@stablesave/core";
import { SegmentedControl, cn } from "@stablesave/ui";
import { AnimatePresence, motion } from "motion/react";

export function RiskSelector({
  value,
  onChange,
  className,
  title = "How much risk are you okay with?",
}: {
  value: RiskProfile;
  onChange: (profile: RiskProfile) => void;
  className?: string;
  title?: string;
}) {
  return (
    <section className={cn("text-center", className)} aria-labelledby="risk-title">
      <h2 id="risk-title" className="text-[15px] font-medium text-fg">
        {title}
      </h2>
      <SegmentedControl
        size="lg"
        label="Risk level"
        value={value}
        onValueChange={onChange}
        options={RISK_PROFILE_IDS.map((id) => ({ value: id, label: RISK_PROFILES[id].label }))}
        className="mx-auto mt-4 max-w-[480px]"
      />
      <div className="relative mx-auto mt-3 h-10 max-w-[420px] sm:h-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-sm text-fg-muted"
          >
            {RISK_PROFILES[value].description}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}
