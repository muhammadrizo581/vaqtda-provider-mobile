// Statistika uchun xom ma'lumot — _port_reference/useProviderStats.ts dan port.
import { useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export interface StatBooking {
  id: string;
  client_id: string;
  booking_date: string;
  start_time: string;
  status: string;
  duration_minutes: number | null;
  price: number | null;
}

export interface StatSlot {
  slot_date: string;
  start_time: string;
  end_time: string;
}

export function useProviderStats() {
  const { provider, loading: providerLoading } = useProvider();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<StatBooking[]>([]);
  const [slots, setSlots] = useState<StatSlot[]>([]);

  const providerId = provider?.id;

  useEffect(() => {
    if (providerLoading) return;
    let cancelled = false;
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const t = setTimeout(async () => {
      if (!providerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [bk, sl] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, client_id, booking_date, start_time, status, duration_minutes, price")
          .eq("provider_id", providerId),
        supabase
          .from("timetable_slots")
          .select("slot_date, start_time, end_time")
          .eq("provider_id", providerId),
      ]);
      if (cancelled) return;
      setBookings((bk.data as StatBooking[]) || []);
      setSlots((sl.data as StatSlot[]) || []);
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [providerId, providerLoading]);

  return { loading, hasProvider: providerLoading ? null : !!provider, bookings, slots };
}
