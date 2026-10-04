"use client";

import type { DataMode } from "@stablesave/core";
import * as React from "react";
import type { PublicEnv } from "@/lib/env";

export interface AppEnvironment extends PublicEnv {
  dataMode: DataMode;
}

const EnvironmentContext = React.createContext<AppEnvironment | null>(null);

export function EnvironmentProvider({ value, children }: { value: AppEnvironment; children: React.ReactNode }) {
  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment(): AppEnvironment {
  const ctx = React.useContext(EnvironmentContext);
  if (!ctx) throw new Error("useEnvironment must be used inside EnvironmentProvider");
  return ctx;
}
