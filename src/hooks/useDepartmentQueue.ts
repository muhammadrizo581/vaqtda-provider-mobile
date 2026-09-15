// Shifokorning o'z bo'limi bo'yicha jonli navbati (department_waitlist).
// Shifokor "bo'shman" deb belgilasa (is_available=true), backend trigger
// (vaqtda-mobile/supabase/migrations/20260813120000_department_waitlist.sql)
// navbatdagi birinchi 'waiting' yozuvni 'notified' qilib, mijozga xabar yuboradi.
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { getMemoryCache, readCache, writeCache, TTL_DYNAMIC } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";

export interface QueueClient {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface QueueEntry {
  id: string;
  client_id: string;
  status: "waiting" | "notified" | "converted" | "cancelled" | "expired" | string;
  note: string | null;
  notified_at: string | null;
  created_at: string;
  client: QueueClient | null;
}

interface DeptQueueCache {
  departmentId: string | null;
  departmentName: string | null;
  isAvailable: boolean;
  entries: QueueEntry[];
}

export function useDepartmentQueue() {
  const { provider } = useProvider();
  const { staffId } = useStaffRoleContext();
  const providerId = provider?.id;
  const cacheKey = providerId && staffId ? `dept_queue.${providerId}.${staffId}` : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<DeptQueueCache>(cacheKey) : null;

  const [departmentId, setDepartmentId] = useState<string | null>(initialCache?.departmentId ?? null);
  const [departmentName, setDepartmentName] = useState<string | null>(initialCache?.departmentName ?? null);
  const [isAvailable, setIsAvailable] = useState<boolean>(initialCache?.isAvailable ?? false);
  const [entries, setEntries] = useState<QueueEntry[]>(initialCache?.entries ?? []);
  const [loading, setLoading] = useState<boolean>(!initialCache);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!providerId || !staffId) {
      setLoading(false);
      return;
    }

    // Disk keshni tekshirish
    const cached = await readCache<DeptQueueCache>(cacheKey);
    if (cached) {
      setDepartmentId(cached.departmentId);
      setDepartmentName(cached.departmentName);
      setIsAvailable(cached.isAvailable);
      setEntries(cached.entries);
      setLoading(false);
    }

    try {
      const { data: staff } = await supabase
        .from("provider_staff")
        .select("department_id, is_available, provider_departments(name)")
        .eq("id", staffId)
        .maybeSingle();

      const deptId = (staff as any)?.department_id ?? null;
      const deptAvailable = !!(staff as any)?.is_available;
      const deptRaw = (staff as any)?.provider_departments?.name;
      const deptNameStr = deptRaw?.uz || deptRaw?.ru || null;

      setDepartmentId(deptId);
      setIsAvailable(deptAvailable);
      setDepartmentName(deptNameStr);

      if (!deptId) {
        setEntries([]);
        if (cacheKey) {
          writeCache(
            cacheKey,
            { departmentId: null, departmentName: null, isAvailable: deptAvailable, entries: [] },
            TTL_DYNAMIC
          ).catch(() => {});
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("department_waitlist")
        .select("id, client_id, status, note, notified_at, created_at")
        .eq("provider_id", providerId)
        .eq("department_id", deptId)
        .in("status", ["waiting", "notified"])
        .order("created_at", { ascending: true });
      if (error) throw error;

      const clientIds = [...new Set((data || []).map((e: any) => e.client_id))];
      let profiles: Record<string, QueueClient> = {};
      if (clientIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .in("id", clientIds);
        profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }

      const freshEntries: QueueEntry[] = (data || []).map((e: any) => ({
        ...e,
        client: profiles[e.client_id] || null,
      }));
      setEntries(freshEntries);

      if (cacheKey) {
        await writeCache(
          cacheKey,
          {
            departmentId: deptId,
            departmentName: deptNameStr,
            isAvailable: deptAvailable,
            entries: freshEntries,
          },
          TTL_DYNAMIC
        );
      }
    } catch {
      // Tarmoq xatosi — kesh (bo'lsa) ko'rinib qoladi, ushlanmagan xato chiqmaydi
    } finally {
      setLoading(false);
    }
  }, [providerId, staffId, cacheKey]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggleAvailability = useCallback(async () => {
    if (!staffId || toggling) return;
    setToggling(true);
    const next = !isAvailable;
    setIsAvailable(next); // optimistik
    const { error } = await supabase.from("provider_staff").update({ is_available: next }).eq("id", staffId);
    setToggling(false);
    if (error) {
      setIsAvailable(!next); // qaytarish
      return;
    }
    load();
  }, [staffId, isAvailable, toggling, load]);

  const setEntryStatus = useCallback(
    async (id: string, status: "converted" | "cancelled") => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (cacheKey) {
          const current = getMemoryCache<DeptQueueCache>(cacheKey);
          if (current) {
            writeCache(cacheKey, { ...current, entries: next }, TTL_DYNAMIC).catch(() => {});
          }
        }
        return next;
      });
      await supabase.from("department_waitlist").update({ status }).eq("id", id);
    },
    [cacheKey]
  );

  return {
    entries,
    loading,
    departmentId,
    departmentName,
    isAvailable,
    toggling,
    toggleAvailability,
    setEntryStatus,
    reload: load,
  };
}
