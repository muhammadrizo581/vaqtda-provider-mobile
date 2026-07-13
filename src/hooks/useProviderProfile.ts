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
  phone_number?: string | null;
  region_id?: string | null;
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
