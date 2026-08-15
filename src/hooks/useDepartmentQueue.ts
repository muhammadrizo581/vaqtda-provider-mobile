// Shifokorning o'z bo'limi bo'yicha jonli navbati (department_waitlist).
// Shifokor "bo'shman" deb belgilasa (is_available=true), backend trigger
// (vaqtda-mobile/supabase/migrations/20260813120000_department_waitlist.sql)
// navbatdagi birinchi 'waiting' yozuvni 'notified' qilib, mijozga xabar yuboradi.
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
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

export function useDepartmentQueue() {
  const { provider } = useProvider();
  const { staffId } = useStaffRoleContext();
  const providerId = provider?.id;

  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!providerId || !staffId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: staff } = await supabase
        .from("provider_staff")
        .select("department_id, is_available, provider_departments(name)")
        .eq("id", staffId)
        .maybeSingle();

      const deptId = (staff as any)?.department_id ?? null;
      setDepartmentId(deptId);
      setIsAvailable(!!(staff as any)?.is_available);
      const deptRaw = (staff as any)?.provider_departments?.name;
      setDepartmentName(deptRaw?.uz || deptRaw?.ru || null);

      if (!deptId) {
        setEntries([]);
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

      setEntries((data || []).map((e: any) => ({ ...e, client: profiles[e.client_id] || null })));
    } finally {
      setLoading(false);
    }
  }, [providerId, staffId]);

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
      setEntries((prev) => prev.filter((e) => e.id !== id));
      await supabase.from("department_waitlist").update({ status }).eq("id", id);
    },
    []
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
