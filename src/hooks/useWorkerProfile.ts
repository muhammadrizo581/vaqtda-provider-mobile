// Joriy foydalanuvchi USTA (staff) bo'lsa — uning provider_staff yozuvi va u
// ishlaydigan biznes (shop provider) yuklanadi. Usta = provider_staff.user_id
// bo'lgan foydalanuvchi (alohida rol yo'q). Owner uchun useProviderProfile bor.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export interface WorkerProfile {
  id: string;
  provider_id: string;
  user_id: string | null;
  full_name: string;
  title: any; // provider_staff.title — jsonb {uz,ru,en} yoki matn (mutaxassislik)
  bio: any; // provider_staff.bio — jsonb yoki matn
  avatar_url: string | null;
  experience_years: number | null;
  is_active: boolean;
  schedule_self_managed: boolean;
  profile_completed: boolean;
  sort_order: number;
}

// Usta ishlaydigan do'kon (biznes) — sarlavha/nomi uchun yetarli qism.
export interface WorkerShop {
  id: string;
  business_name: any; // jsonb {uz,ru,en} yoki matn
  category_id: string | null;
  avatar_url: string | null;
  // Owner tugmasi: ustalar o'z narxini belgilaydimi (staff_services.price)
  staff_sets_own_price: boolean;
}

export function useWorkerProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const isWorker = user?.role === "worker";
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [shop, setShop] = useState<WorkerShop | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !isWorker) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: w } = await supabase
      .from("provider_staff")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const workerRow = (w as WorkerProfile) || null;
    setWorker(workerRow);
    if (workerRow?.provider_id) {
      const { data: p } = await supabase
        .from("providers")
        .select("id, business_name, category_id, avatar_url, staff_sets_own_price")
        .eq("id", workerRow.provider_id)
        .maybeSingle();
      setShop((p as WorkerShop) || null);
    } else {
      setShop(null);
    }
    setLoading(false);
  }, [userId, isWorker]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { worker, shop, loading, reload: load };
}
