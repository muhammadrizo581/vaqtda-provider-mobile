// Usta (worker) rejimi konteksti — worker yozuvi va u ishlaydigan biznes bir joydan.
import React, { createContext, useContext } from "react";
import {
  useWorkerProfile,
  type WorkerProfile,
  type WorkerShop,
} from "@/hooks/useWorkerProfile";

interface WorkerContextType {
  worker: WorkerProfile | null;
  shop: WorkerShop | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

export function WorkerProvider({ children }: { children: React.ReactNode }) {
  const value = useWorkerProfile();
  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}

export function useWorker() {
  const ctx = useContext(WorkerContext);
  if (ctx === undefined) throw new Error("useWorker must be used within WorkerProvider");
  return ctx;
}
