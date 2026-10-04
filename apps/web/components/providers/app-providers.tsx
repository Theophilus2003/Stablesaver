"use client";

import { MotionConfig } from "motion/react";
import * as React from "react";
import { OnboardingProvider } from "@/components/onboarding/onboarding";
import { WalletProviders } from "@/components/wallet/wallet-providers";
import { EnvironmentProvider, type AppEnvironment } from "./environment";

export function AppProviders({ environment, children }: { environment: AppEnvironment; children: React.ReactNode }) {
  return (
    <EnvironmentProvider value={environment}>
      <MotionConfig reducedMotion="user">
        <WalletProviders>
          <OnboardingProvider>{children}</OnboardingProvider>
        </WalletProviders>
      </MotionConfig>
    </EnvironmentProvider>
  );
}
