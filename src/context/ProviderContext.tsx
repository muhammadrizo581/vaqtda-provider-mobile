// Dashboard ichida provider profili bitta joydan (bir marta) yuklanadi.
import React, { createContext, useContext } from "react";
import { useProviderProfile, type ProviderProfile } from "@/hooks/useProviderProfile";

interface ProviderContextType {
  provider: ProviderProfile | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const value = useProviderProfile();
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useProvider() {
  const ctx = useContext(ProviderContext);
  if (ctx === undefined) throw new Error("useProvider must be used within ProviderProvider");
  return ctx;
}
