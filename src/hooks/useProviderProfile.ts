// Joriy foydalanuvchining provider profili (providers jadvalidan).
//
// Ega (owner) uchun — o'z biznesi (providers.user_id = uid).
// Klinika xodimi (shifokor) uchun — u ishlaydigan klinika (provider_staff.provider_id).
// Xodim uchun bu profil FAQAT o'qish uchun: biznes profilini u tahrirlay olmaydi.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { getMemoryCache, readCache, writeCache, TTL_PROFILE } from "@/lib/offline-cache";
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
  // Biznes formati: corporate (salon/klinika/boshliq+ustalar) yoki individual (yakka usta/mutaxassis)
  business_type?: "corporate" | "individual" | null;
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

  // Tarif (subscription): 60 kunlik bepul PRO sinov, keyin PLUS/PRO — Click/Payme orqali
  // sotib olinadi, to'lov tushganda bazadagi trigger shu maydonlarni yangilaydi.
  // Holatni utils/plan.ts getSubscription() hisoblaydi.
  plan_code?: "plus" | "pro" | null;
  subscription_status?: "trial" | "active" | "expired" | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  has_paid_at_least_once?: boolean | null;
  is_featured?: boolean | null;

  // Ichki hisob raqam (wallet) — tolov-hisob.sql beradi
  account_number?: string | null;
}

export function useProviderProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const { loading: roleLoading, isStaff, staffProviderId } = useStaffRoleContext();

  const cacheKey = userId
    ? `provider.${userId}.${isStaff ? staffProviderId || "unknown" : "owner"}`
    : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant render)
  const [provider, setProvider] = useState<ProviderProfile | null>(() =>
    cacheKey ? getMemoryCache<ProviderProfile>(cacheKey) : null
  );
  const [loading, setLoading] = useState<boolean>(() => !provider);

  const load = useCallback(async () => {
    // Rol aniqlanmaguncha kutamiz — aks holda xodimga "biznesingiz yo'q"
    // deb ko'rsatilib, keyin klinika yuklanib, ekran sakrab ketardi.
    if (roleLoading) return;
    if (!userId) {
      setProvider(null);
      setLoading(false);
      return;
    }

    const key = `provider.${userId}.${isStaff ? staffProviderId || "unknown" : "owner"}`;

    // Agar RAM bo'sh bo'lsa, tezda diskdagi keshni o'qib ko'rsatamiz (foydalanuvchi kutmasligi uchun)
    const cached = await readCache<ProviderProfile>(key);
    if (cached) {
      setProvider(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const base = supabase.from("providers").select("*");
      // Xodim — o'zi ishlaydigan klinika; ega — o'z biznesi
      const result =
        isStaff && staffProviderId
          ? await base.eq("id", staffProviderId).maybeSingle()
          : await base.eq("user_id", userId).maybeSingle();
      if (result.error) throw result.error;
      const fresh = (result.data as ProviderProfile) || null;
      setProvider(fresh);
      if (fresh) await writeCache(key, fresh, TTL_PROFILE);
    } catch {
      // Tarmoq xatosi bo'lsa va disk kesh bo'lsa, ushlab qolamiz
      if (!cached) {
        const fallback = await readCache<ProviderProfile>(key);
        if (fallback) setProvider(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, roleLoading, isStaff, staffProviderId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { provider, loading, reload: load };
}
