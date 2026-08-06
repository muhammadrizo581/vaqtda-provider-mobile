// Statistika uchun xom ma'lumot — _port_reference/useProviderStats.ts dan port.
//
// Klinika XODIMI (shifokor) kirgan bo'lsa — barcha raqamlar faqat uning o'z
// bronlari va o'z jadvali bo'yicha hisoblanadi: so'rovlar shu yerda staff_id
// bilan cheklanadi, ya'ni shifokorga klinika bo'ylab ma'lumot umuman kelmaydi.
import { useEffect, useState } from "react";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
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
  const { loading: roleLoading, isStaff, staffId } = useStaffRoleContext();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<StatBooking[]>([]);
  const [slots, setSlots] = useState<StatSlot[]>([]);

  const providerId = provider?.id;
  // Klinikada jadval butun biznesga umumiy bo'lishi mumkin ("shared") — u holda
  // shifokorning ish vaqti staff_id NULL bo'lgan qatorlardan olinadi.
  // Bronlar esa doim staff_id bilan ajratiladi.
  const sharedSchedule = provider?.schedule_mode === "shared";

  useEffect(() => {
    // Rol aniqlanmaguncha kutamiz — aks holda shifokorga bir zumda klinika
    // bo'yicha umumiy raqamlar ko'rinib qolardi
    if (providerLoading || roleLoading) return;
    let cancelled = false;
    // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
    const t = setTimeout(async () => {
      if (!providerId || (isStaff && !staffId)) {
        setBookings([]);
        setSlots([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let bkQ = supabase
        .from("bookings")
        .select("id, client_id, booking_date, start_time, status, duration_minutes, price")
        .eq("provider_id", providerId);
      let slQ = supabase
        .from("timetable_slots")
        .select("slot_date, start_time, end_time")
        .eq("provider_id", providerId);
      if (isStaff && staffId) {
        bkQ = bkQ.eq("staff_id", staffId);
        // Klinika "shared" jadval rejimida bo'lsa, shifokorning ish vaqti butun
        // biznesniki — qatorlarda staff_id NULL turadi
        slQ = sharedSchedule ? slQ.is("staff_id", null) : slQ.eq("staff_id", staffId);
      }
      const [bk, sl] = await Promise.all([bkQ, slQ]);
      if (cancelled) return;
      // staff_id ustuni hali qo'shilmagan bo'lsa so'rov xato qaytaradi —
      // bunday holatda shifokorga bo'sh statistika ko'rsatiladi, umumiy EMAS
      setBookings(bk.error ? [] : (bk.data as StatBooking[]) || []);
      setSlots(sl.error ? [] : (sl.data as StatSlot[]) || []);
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [providerId, providerLoading, roleLoading, isStaff, staffId, sharedSchedule]);

  return { loading, hasProvider: providerLoading ? null : !!provider, bookings, slots };
}
