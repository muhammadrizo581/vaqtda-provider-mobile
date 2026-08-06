// Ega/xodim roli butun ilova bo'ylab BITTA marta aniqlanadi.
//
// useStaffRole() hook'i har chaqirilganda Supabase'ga so'rov yuboradi, rol esa
// juda ko'p joyda kerak (darvoza, tablar, jadval, bronlar, provider profili…) —
// shuning uchun natija shu kontekstda saqlanib, hammaga bir nusxadan beriladi.
//
// Diqqat: ProviderProvider shu provayder ICHIDA bo'lishi shart — chunki xodim
// uchun provider profili staffProviderId bo'yicha yuklanadi.
import React, { createContext, useContext } from "react";
import { useStaffRole, type StaffRole } from "@/hooks/useStaffRole";

const StaffRoleContext = createContext<StaffRole | undefined>(undefined);

export function StaffRoleProvider({ children }: { children: React.ReactNode }) {
  const value = useStaffRole();
  return <StaffRoleContext.Provider value={value}>{children}</StaffRoleContext.Provider>;
}

export function useStaffRoleContext(): StaffRole {
  const ctx = useContext(StaffRoleContext);
  if (ctx === undefined) {
    throw new Error("useStaffRoleContext must be used within StaffRoleProvider");
  }
  return ctx;
}
