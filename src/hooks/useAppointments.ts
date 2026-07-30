// Provayder bronlari — to'g'ridan-to'g'ri Supabase'dan (web'dagi
// /api/provider/appointments logikasi bilan bir xil, lekin RLS ostida).
import { useCallback, useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export interface AppointmentClient {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface Appointment {
  id: string;
  client_id: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
  duration_minutes: number | null;
  status: "upcoming" | "completed" | "cancelled" | string;
  notes: string | null;
  price: number | null;
  service_id: string | null;
  created_at: string;
  services: { name: any } | null;
  client: AppointmentClient | null;
  // Restoran: tanlangan stol; Dacha: ketish sanasi (booking_date — kelish)
  table_id: string | null;
  date_to: string | null; // YYYY-MM-DD
  table_name: string | null;
}

export function useAppointments() {
  const { provider } = useProvider();
  const providerId = provider?.id;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const BASE_COLS =
        "id, client_id, booking_date, start_time, end_time, duration_minutes, status, notes, price, service_id, created_at";
      let { data: bookings, error: err } = await supabase
        .from("bookings")
        .select(`${BASE_COLS}, table_id, date_to, services(name)`)
        .eq("provider_id", providerId)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });
      if (err) {
        // table_id/date_to ustunlari hali qo'shilmagan bo'lsa (SQL ishga
        // tushirilmagan) — eski ustunlar bilan qayta so'raymiz
        const legacy = await supabase
          .from("bookings")
          .select(`${BASE_COLS}, services(name)`)
          .eq("provider_id", providerId)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false });
        bookings = legacy.data as any;
        err = legacy.error;
      }
      if (err) throw err;

      // Mijoz profillari (ism, telefon, avatar)
      const clientIds = [...new Set((bookings || []).map((b: any) => b.client_id))];
      let profiles: Record<string, AppointmentClient> = {};
      if (clientIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .in("id", clientIds);
        profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }

      // Restoran stollari nomlari (table_id bo'lgan bronlar uchun)
      const tableIds = [...new Set((bookings || []).map((b: any) => b.table_id).filter(Boolean))];
      let tableNames: Record<string, string> = {};
      if (tableIds.length > 0) {
        const { data: tbls } = await supabase
          .from("restaurant_tables")
          .select("id, name")
          .in("id", tableIds);
        tableNames = Object.fromEntries((tbls || []).map((x: any) => [x.id, x.name]));
      }

      setAppointments(
        (bookings || []).map((b: any) => ({
          ...b,
          services: Array.isArray(b.services) ? b.services[0] || null : b.services,
          client: profiles[b.client_id] || null,
          table_name: b.table_id ? tableNames[b.table_id] || null : null,
        }))
      );
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // action: "cancel" | "complete"
  const act = useCallback(
    async (id: string, action: "cancel" | "complete") => {
      const status = action === "cancel" ? "cancelled" : "completed";
      // .select() — RLS jim rad etsa (0 qator) ham aniqlaymiz, aks holda UI
      // o'zgargan bo'lib ko'rinib, refresh'da eski holatga qaytib qolardi
      const { data, error: err } = await supabase
        .from("bookings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("provider_id", provider?.id || "")
        .select("id");
      if (err || !data || data.length === 0) return false;
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      return true;
    },
    [provider?.id]
  );

  return { appointments, loading, error, reload: load, act };
}
