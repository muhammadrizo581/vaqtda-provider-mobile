// Panelga kirgan foydalanuvchining roli: biznes EGASI yoki KLINIKA XODIMI (shifokor).
//
// Bitta klinika = bitta biznes akkaunti (providers.user_id — egasi).
// Unda ishlaydigan shifokorlar alohida akkauntga ega bo'ladi va
// provider_staff.user_id orqali shu biznesga bog'lanadi (taklif kodi bilan).
//
//   isOwner  — o'z biznesi bor (to'liq panel)
//   isStaff  — biror klinikaga biriktirilgan shifokor (cheklangan panel)
//   ikkalasi ham false — hali biznes ham yaratmagan, taklif kodi ham kiritmagan
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export interface StaffRole {
  loading: boolean;
  isOwner: boolean;
  isStaff: boolean;
  /** Xodim bo'lsa — uning provider_staff.id si */
  staffId: string | null;
  /** Xodim bo'lsa — u ishlaydigan klinikaning id si */
  staffProviderId: string | null;
  staffName: string | null;
  reload: () => Promise<void>;
}

export function useStaffRole(): StaffRole {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffProviderId, setStaffProviderId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setIsOwner(false);
      setStaffId(null);
      setStaffProviderId(null);
      setStaffName(null);
      return;
    }
    setLoading(true);

    // 1) O'z biznesi bormi (egasi)?
    const { data: own } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const owner = !!own?.id;
    setIsOwner(owner);

    // 2) Egasi bo'lmasa — biror klinikaga biriktirilgan shifokormi?
    if (!owner) {
      const { data: staff } = await supabase
        .from("provider_staff")
        .select("id, provider_id, full_name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .maybeSingle();
      setStaffId(staff?.id ?? null);
      setStaffProviderId(staff?.provider_id ?? null);
      setStaffName(staff?.full_name ?? null);
    } else {
      setStaffId(null);
      setStaffProviderId(null);
      setStaffName(null);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return {
    loading,
    isOwner,
    isStaff: !isOwner && !!staffId,
    staffId,
    staffProviderId,
    staffName,
    reload: load,
  };
}
