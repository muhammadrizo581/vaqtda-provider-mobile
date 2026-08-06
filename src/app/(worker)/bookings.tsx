// Usta o'z bronlarini ko'radi — bookings.staff_id = ustaning provider_staff.id.
// Faqat o'qish (RLS: mobile_staff_read_bookings). Ko'rsatiladi: sana, vaqt, mijoz,
// xizmat, holat, narx.
import { CalendarDays, CheckCircle2 } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { Card, ClientAvatar, EmptyState, PageHeader, SmallButton, Spinner } from "@/components/pv/ui";
import { alpha } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useWorker } from "@/context/WorkerContext";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { formatSom } from "@/utils/price";
import { formatUzDate } from "@/utils/tashkent";

interface WorkerBooking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  price: number | null;
  client_id: string;
  service_name: any;
  client_name: string | null;
  client_avatar: string | null;
}

const hhmm = (s?: string | null) => (s || "").slice(0, 5);

export default function WorkerBookingsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { t } = useLanguage();
  const { worker } = useWorker();
  const workerId = worker?.id || null;

  const [bookings, setBookings] = useState<WorkerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, status, price, client_id, services(name)")
      .eq("staff_id", workerId)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false });

    const list = (rows || []) as any[];
    const clientIds = [...new Set(list.map((b) => b.client_id))];
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (clientIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", clientIds);
      profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
    }

    setBookings(
      list.map((b) => ({
        id: b.id,
        booking_date: b.booking_date,
        start_time: b.start_time,
        status: b.status,
        price: b.price,
        client_id: b.client_id,
        service_name: Array.isArray(b.services) ? b.services[0]?.name : b.services?.name,
        client_name: profiles[b.client_id]?.full_name || null,
        client_avatar: profiles[b.client_id]?.avatar_url || null,
      }))
    );
    setLoading(false);
  }, [workerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Usta o'z bronini yakunlaydi. Worker'da bookings'ga to'g'ridan-to'g'ri UPDATE
  // RLS bilan yopiq — shu sabab SECURITY DEFINER RPC complete_booking (egalik
  // tekshiruvi + status='completed' + mijozga "yakunlandi, baho bering" in-app xabari
  // o'sha yerda). Muvaffaqiyatda ro'yxat yangilanadi.
  const handleComplete = useCallback(
    async (bookingId: string) => {
      setActingId(bookingId);
      const { error } = await supabase.rpc("complete_booking", { p_booking_id: bookingId });
      setActingId(null);
      if (error) {
        Alert.alert(t("pv.act_failed"));
        return;
      }
      load();
    },
    [t, load]
  );

  const statusStyle = (status: string) => {
    if (status === "completed") return { bg: alpha(colors.primaryContainer, 0.2), fg: colors.primary, label: t("pv.status_completed") };
    if (status === "cancelled") return { bg: alpha(colors.errorContainer, 0.25), fg: colors.error, label: t("pv.status_cancelled") };
    return { bg: alpha(colors.secondaryContainer, 0.2), fg: colors.secondary, label: t("pv.status_upcoming") };
  };

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader title={t("wk.my_bookings")} subtitle={t("wk.bookings_sub")} />

      {loading && bookings.length === 0 ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title={t("wk.no_bookings")} desc={t("wk.no_bookings_desc")} />
        </Card>
      ) : (
        bookings.map((b) => {
          const st = statusStyle(b.status);
          const cancelled = b.status === "cancelled";
          return (
            <Card key={b.id} style={[{ padding: 16 }, cancelled && { opacity: 0.65 }]}>
              <View style={styles.row}>
                <ClientAvatar name={b.client_name} avatarUrl={b.client_avatar} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.client} numberOfLines={1}>
                    {b.client_name || "—"}
                  </Text>
                  <Text style={styles.service} numberOfLines={1}>
                    {localize(b.service_name) || t("profile.service_fallback")}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {formatUzDate(b.booking_date)} · {hhmm(b.start_time)}
                </Text>
                {b.price != null ? <Text style={styles.price}>{formatSom(b.price)}</Text> : null}
              </View>
              {/* Yakunlash — faqat hali yakunlanmagan/bekor qilinmagan bronlarda */}
              {b.status !== "completed" && b.status !== "cancelled" ? (
                <View style={styles.actionRow}>
                  <SmallButton
                    label={t("pv.complete")}
                    icon={CheckCircle2}
                    loading={actingId === b.id}
                    onPress={() => handleComplete(b.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    client: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
    service: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
    },
    meta: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
    price: { fontSize: 15, fontWeight: "700", color: colors.secondary },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  })
);
