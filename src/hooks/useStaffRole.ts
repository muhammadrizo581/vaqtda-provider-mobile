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
import { getMemoryCache, readCache, writeCache, TTL_PROFILE } from "@/lib/offline-cache";
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

interface StaffRoleCache {
  isOwner: boolean;
  staffId: string | null;
  staffProviderId: string | null;
  staffName: string | null;
}

export function useStaffRole(): StaffRole {
  const { user } = useAuth();
  const userId = user?.id || null;
  const cacheKey = userId ? `role.${userId}` : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<StaffRoleCache>(cacheKey) : null;

  const [loading, setLoading] = useState<boolean>(!initialCache && !!userId);
  const [isOwner, setIsOwner] = useState<boolean>(initialCache?.isOwner ?? false);
  const [staffId, setStaffId] = useState<string | null>(initialCache?.staffId ?? null);
  const [staffProviderId, setStaffProviderId] = useState<string | null>(initialCache?.staffProviderId ?? null);
  const [staffName, setStaffName] = useState<string | null>(initialCache?.staffName ?? null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setIsOwner(false);
      setStaffId(null);
      setStaffProviderId(null);
      setStaffName(null);
      return;
    }

    // Disk keshni tekshirish
    const cached = await readCache<StaffRoleCache>(cacheKey);
    if (cached) {
      setIsOwner(cached.isOwner);
      setStaffId(cached.staffId);
      setStaffProviderId(cached.staffProviderId);
      setStaffName(cached.staffName);
      setLoading(false);
    }

    try {
      // 1) O'z biznesi bormi (egasi)?
      const { data: own } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const owner = !!own?.id;
      setIsOwner(owner);

      let sid: string | null = null;
      let spid: string | null = null;
      let sname: string | null = null;

      // 2) Egasi bo'lmasa — biror klinikaga biriktirilgan shifokormi?
      if (!owner) {
        const { data: staff } = await supabase
          .from("provider_staff")
          .select("id, provider_id, full_name")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .maybeSingle();
        sid = staff?.id ?? null;
        spid = staff?.provider_id ?? null;
        sname = staff?.full_name ?? null;
      }

      setStaffId(sid);
      setStaffProviderId(spid);
      setStaffName(sname);

      const record: StaffRoleCache = {
        isOwner: owner,
        staffId: sid,
        staffProviderId: spid,
        staffName: sname,
      };
      await writeCache(cacheKey, record, TTL_PROFILE);
    } catch {
      // Tarmoq xatosi bo'lsa kesh saqlanadi
    } finally {
      setLoading(false);
    }
  }, [userId, cacheKey]);

  useEffect(() => {
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
