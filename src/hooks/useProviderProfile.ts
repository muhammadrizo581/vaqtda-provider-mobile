// Joriy foydalanuvchining provider profili (providers jadvalidan).
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
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
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setProvider((data as ProviderProfile) || null);
    setLoading(false);
  }, [userId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { provider, loading, reload: load };
}
