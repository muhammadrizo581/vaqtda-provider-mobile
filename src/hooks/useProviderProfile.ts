// Joriy foydalanuvchining provider profili (providers jadvalidan).
//
// Ega (owner) uchun — o'z biznesi (providers.user_id = uid).
// Klinika xodimi (shifokor) uchun — u ishlaydigan klinika (provider_staff.provider_id).
// Xodim uchun bu profil FAQAT o'qish uchun: biznes profilini u tahrirlay olmaydi.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { supabase } from "@/lib/supabase";

export interface ProviderProfile {
  id: string;
  user_id: string;
  business_name: any; // jsonb {uz,ru,en} yoki matn
  slug: string;
  category_id: string | null;
  location: string | null;
  about: any;
  avatar_url: string | null;
  rating: number;
  reviews_count: number;
  status: string; // pending | approved | ...
  is_active: boolean;
  // Ustalar o'z narxini belgilaydimi (workers.tsx tugmasi)
  staff_sets_own_price?: boolean;
  phone_number?: string | null;
  region_id?: string | null;
  // Klinika jadval rejimi: "shared" — butun biznesga bitta jadval,
  // "individual" — har bir shifokor o'z jadvalini tuzadi.
  // Ustun hali qo'shilmagan bo'lsa undefined bo'ladi — bunda eski
  // xatti-harakat (har kimga alohida) saqlanib qoladi.
  schedule_mode?: "shared" | "individual" | null;
  // To'lov sozlamalari (payment-settings sahifasi boshqaradi)
  prepayment_type?: "none" | "percent" | "fixed" | "full" | null;
  prepayment_percent?: number | null;
  prepayment_amount?: number | null;
  // Ichki hisob raqam (wallet) — tolov-hisob.sql beradi
  account_number?: string | null;
}

export function useProviderProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const { loading: roleLoading, isStaff, staffProviderId } = useStaffRoleContext();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Rol aniqlanmaguncha kutamiz — aks holda xodimga "biznesingiz yo'q"
    // deb ko'rsatilib, keyin klinika yuklanib, ekran sakrab ketardi.
    if (roleLoading) return;
    if (!userId) {
      setProvider(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const base = supabase.from("providers").select("*");
    // Xodim — o'zi ishlaydigan klinika; ega — o'z biznesi
    const { data } =
      isStaff && staffProviderId
        ? await base.eq("id", staffProviderId).maybeSingle()
        : await base.eq("user_id", userId).maybeSingle();
    setProvider((data as ProviderProfile) || null);
    setLoading(false);
  }, [userId, roleLoading, isStaff, staffProviderId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { provider, loading, reload: load };
}
