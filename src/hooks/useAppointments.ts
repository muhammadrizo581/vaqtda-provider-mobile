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
  // Bron qaysi xodimga (provider_staff) belgilangan —
  // sartaroshxonada usta, klinikada shifokor
  staff_id: string | null;
  staff_name: string | null;
  // Shu bron uchun allaqachon to'langan summa (oldindan to'lov + qolgani).
  // Qolgan summa = (price || 0) − paid_amount.
  paid_amount: number;
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
        .select(`${BASE_COLS}, table_id, date_to, staff_id, services(name)`)
        .eq("provider_id", providerId)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });
      if (err) {
        // staff_id ustuni hali qo'shilmagan bo'lsa — usiz qayta so'raymiz
        const noStaff = await supabase
          .from("bookings")
          .select(`${BASE_COLS}, table_id, date_to, services(name)`)
          .eq("provider_id", providerId)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false });
        bookings = noStaff.data as any;
        err = noStaff.error;
      }
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

      // Xodimlar (usta/shifokor) ismlari — staff_id bo'lgan bronlar uchun.
      // Jadval hali yaratilmagan bo'lsa — bo'sh qoladi, qatorda ko'rsatilmaydi.
      const staffIds = [...new Set((bookings || []).map((b: any) => b.staff_id).filter(Boolean))];
      let staffNames: Record<string, string> = {};
      if (staffIds.length > 0) {
        const { data: stf } = await supabase
          .from("provider_staff")
          .select("id, full_name")
          .in("id", staffIds);
        staffNames = Object.fromEntries((stf || []).map((x: any) => [x.id, x.full_name]));
      }

      // Har bron uchun to'langan summa (payments 'paid') — qolgan summani hisoblash uchun
      const bookingIds = [...new Set((bookings || []).map((b: any) => b.id).filter(Boolean))];
      const paidByBooking: Record<string, number> = {};
      if (bookingIds.length > 0) {
        const { data: pays } = await supabase
          .from("payments")
          .select("booking_id, amount, status")
          .in("booking_id", bookingIds)
          .eq("status", "paid");
        (pays || []).forEach((p: any) => {
          paidByBooking[p.booking_id] = (paidByBooking[p.booking_id] || 0) + Number(p.amount || 0);
        });
      }

      setAppointments(
        (bookings || []).map((b: any) => ({
          ...b,
          services: Array.isArray(b.services) ? b.services[0] || null : b.services,
          client: profiles[b.client_id] || null,
          table_name: b.table_id ? tableNames[b.table_id] || null : null,
          staff_id: b.staff_id ?? null,
          staff_name: b.staff_id ? staffNames[b.staff_id] || null : null,
          paid_amount: paidByBooking[b.id] || 0,
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
      // Yakunlanganda mijozga IN-APP "yakunlandi — baho bering" (review_request)
      // xabarini yuboramiz. Bazadagi emitter buni FAQAT uchrashuv vaqti o'tgach
      // yaratadi — shu sabab kelgusi sanadagi bronni erta yakunlaganda mijozga xabar
      // bormaydi. RPC (emit_review_request) buni to'g'irlaydi. Best-effort: RPC xato
      // bersa (masalan hali qo'shilmagan) yakunlashning o'zi buzilmaydi.
      if (action === "complete") {
        const { error: rpcErr } = await supabase.rpc("emit_review_request", { p_booking_id: id });
        if (rpcErr) console.warn("emit_review_request:", rpcErr.message);
      }
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      return true;
    },
    [provider?.id]
  );

  // Qolgan summani NAQD qabul qilib bandlikni yopish: payments'ga cash/paid
  // yozuv qo'shamiz (statistika + hisob raqamga kiradi), so'ng 'completed'.
  // clientId — payments.client_id NOT NULL bo'lgani uchun majburiy.
  const settleCashAndComplete = useCallback(
    async (id: string, amount: number, clientId: string) => {
      const providerId = provider?.id;
      if (!providerId) return false;
      if (amount > 0) {
        const { error: payErr } = await supabase.from("payments").insert({
          booking_id: id,
          provider_id: providerId,
          client_id: clientId,
          amount,
          method: "cash",
          channel: "cash",
          kind: "remainder",
          status: "paid",
          paid_at: new Date().toISOString(),
        });
        if (payErr) return false;
        // Bron to'liq to'landi deb belgilaymiz (mijoz ilovasi uchun izchillik)
        await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", id);
      }
      const ok = await act(id, "complete");
      if (ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, paid_amount: a.paid_amount + amount } : a))
        );
      }
      return ok;
    },
    [provider?.id, act]
  );

  return { appointments, loading, error, reload: load, act, settleCashAndComplete };
}