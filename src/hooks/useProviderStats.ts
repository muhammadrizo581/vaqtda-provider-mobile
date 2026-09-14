// Statistika uchun xom ma'lumot — _port_reference/useProviderStats.ts dan port.
//
// Klinika XODIMI (shifokor) kirgan bo'lsa — barcha raqamlar faqat uning o'z
// bronlari va o'z jadvali bo'yicha hisoblanadi: so'rovlar shu yerda staff_id
// bilan cheklanadi, ya'ni shifokorga klinika bo'ylab ma'lumot umuman kelmaydi.
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { getMemoryCache, readCache, writeCache, TTL_DYNAMIC } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";

export interface StatBooking {
  id: string;
  client_id: string;
  booking_date: string;
  start_time: string;
  status: string;
  duration_minutes: number | null;
  price: number | null;
  service_id: string | null;
  service_name: any;
  staff_id: string | null;
  staff_name: string | null;
  client_name: string | null;
  client_avatar: string | null;
}

export interface StatSlot {
  slot_date: string;
  start_time: string;
  end_time: string;
}

interface StatsCache {
  bookings: StatBooking[];
  slots: StatSlot[];
}

export function useProviderStats() {
  const { provider, loading: providerLoading } = useProvider();
  const { loading: roleLoading, isStaff, staffId } = useStaffRoleContext();

  const providerId = provider?.id;
  const sharedSchedule = provider?.schedule_mode === "shared";
  const cacheKey = providerId
    ? `stats.${providerId}.${isStaff ? staffId : "all"}.${sharedSchedule}`
    : "";

  // 1. RAM xotiradan sinxron o'qish (0ms instant)
  const initialCache = cacheKey ? getMemoryCache<StatsCache>(cacheKey) : null;

  const [loading, setLoading] = useState<boolean>(!initialCache);
  const [bookings, setBookings] = useState<StatBooking[]>(initialCache?.bookings ?? []);
  const [slots, setSlots] = useState<StatSlot[]>(initialCache?.slots ?? []);

  const load = useCallback(async () => {
    if (!providerId || (isStaff && !staffId)) {
      setBookings([]);
      setSlots([]);
      setLoading(false);
      return;
    }

    try {
      let bkQ = supabase
        .from("bookings")
        .select("id, client_id, booking_date, start_time, status, duration_minutes, price, service_id, staff_id, notes, services(name)")
        .eq("provider_id", providerId)
        .order("booking_date", { ascending: false });

      let slQ = supabase
        .from("timetable_slots")
        .select("slot_date, start_time, end_time")
        .eq("provider_id", providerId);

      if (isStaff && staffId) {
        bkQ = bkQ.eq("staff_id", staffId);
        slQ = sharedSchedule ? slQ.is("staff_id", null) : slQ.eq("staff_id", staffId);
      }

      const [bkRes, slRes] = await Promise.all([bkQ, slQ]);

      // Tarif to'lovi buyurtmalari (notes = "SUB__…") daromad statistikasiga kirmaydi
      const rawBookings = (bkRes.error ? [] : (bkRes.data as any[]) || []).filter(
        (b) => !String(b.notes || "").startsWith("SUB__")
      );
      const freshSlots = slRes.error ? [] : (slRes.data as StatSlot[]) || [];

      // Mijozlar profillari va xodimlar ma'lumotlarini to'ldiramiz
      const clientIds = [...new Set(rawBookings.map((b) => b.client_id).filter(Boolean))];
      let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (clientIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", clientIds);
        profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }

      const staffIds = [...new Set(rawBookings.map((b) => b.staff_id).filter(Boolean))];
      let staffMap: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: stf } = await supabase
          .from("provider_staff")
          .select("id, full_name")
          .in("id", staffIds);
        staffMap = Object.fromEntries((stf || []).map((s: any) => [s.id, s.full_name]));
      }

      const freshBookings: StatBooking[] = rawBookings.map((b) => {
        const sName = Array.isArray(b.services)
          ? b.services[0]?.name
          : b.services?.name;
        const profile = profiles[b.client_id];
        return {
          id: b.id,
          client_id: b.client_id,
          booking_date: b.booking_date,
          start_time: b.start_time,
          status: b.status,
          duration_minutes: b.duration_minutes,
          price: b.price,
          service_id: b.service_id || null,
          service_name: sName || null,
          staff_id: b.staff_id || null,
          staff_name: b.staff_id ? staffMap[b.staff_id] || null : null,
          client_name: profile?.full_name || null,
          client_avatar: profile?.avatar_url || null,
        };
      });

      setBookings(freshBookings);
      setSlots(freshSlots);

      await writeCache(
        cacheKey,
        { bookings: freshBookings, slots: freshSlots },
        TTL_DYNAMIC
      );
    } catch {
      // Tarmoq xatosi bo'lsa kesh saqlanadi
    } finally {
      setLoading(false);
    }
  }, [providerId, isStaff, staffId, sharedSchedule, cacheKey]);

  useEffect(() => {
    if (providerLoading || roleLoading) return;
    let cancelled = false;

    const t = setTimeout(async () => {
      const cached = await readCache<StatsCache>(cacheKey);
      if (cached && !cancelled) {
        setBookings(cached.bookings);
        setSlots(cached.slots);
        setLoading(false);
      }
      if (!cancelled) {
        await load();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [providerLoading, roleLoading, cacheKey, load]);

  return { loading, hasProvider: providerLoading ? null : !!provider, bookings, slots, reload: load };
}
