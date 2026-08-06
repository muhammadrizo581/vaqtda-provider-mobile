// Boshqaruv (Overview) — "Grafit Zumrad" qayta dizayni.
// Tartib: salomlashuv → zumrad hero (bugungi daromad) → ikkita ixcham stat chip →
// "Keyingi bron" spotlight → qolgan bronlar vaqt izi (timeline) bo'ylab.
import { useRouter } from "expo-router";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Hourglass,
  Settings,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { BusinessGate } from "@/components/pv/business-gate";
import { MonthOverviewModal } from "@/components/pv/month-overview";
import { Screen } from "@/components/pv/screen";
import {
  ClientAvatar,
  GlassIconButton,
  GlassSurface,
  Spinner,
} from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useAppointments, type Appointment } from "@/hooks/useAppointments";
import { useWaitlistEntries } from "@/hooks/useWaitlistEntries";
import { supabase } from "@/lib/supabase";
import { formatSom } from "@/utils/price";
import { addDaysStr, createTashkentClock, formatUzDate } from "@/utils/tashkent";

const tashkentClock = createTashkentClock();

// "HH:MM[:SS]" -> daqiqa
const toMin = (t?: string | null) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Bugungi jadval slotlari — bandlik foizi uchun.
// Shifokor kirgan bo'lsa faqat O'Z slotlari olinadi (RLS ham shunday beradi).
function useTodaySlots(today: string, staffId: string | null) {
  const { provider } = useProvider();
  const providerId = provider?.id;
  // Klinikada jadval "shared" rejimida butun biznesga umumiy bo'ladi — u holda
  // shifokorning ish vaqti staff_id NULL bo'lgan qatorlarda turadi.
  const sharedSchedule = provider?.schedule_mode === "shared";
  const [slots, setSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let q = supabase
        .from("timetable_slots")
        .select("start_time, end_time")
        .eq("provider_id", providerId)
        .eq("slot_date", today);
      if (staffId) q = sharedSchedule ? q.is("staff_id", null) : q.eq("staff_id", staffId);
      const { data } = await q;
      if (!cancelled) setSlots((data as { start_time: string; end_time: string }[]) || []);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [providerId, today, staffId, sharedSchedule]);
  return slots;
}

// Halqa indikator — bugungi bandlik foizi
function ProgressRing({
  size = 44,
  stroke = 5,
  progress,
  color,
  track,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const hhmm = (t: string) => (t || "").slice(0, 5);

// Ixcham ustunli grafik — 7 kunlik daromad (Screen Time uslubida bosiladigan)
function MiniBars({
  data,
  color,
  track,
  selected,
  onSelect,
}: {
  data: { label: string; value: number }[];
  color: string;
  track: string;
  selected?: number | null;
  onSelect?: (i: number) => void;
}) {
  const styles = useStyles();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.miniChart}>
      {data.map((d, i) => {
        const dim = selected != null && selected !== i;
        return (
          <Pressable key={i} style={styles.miniCol} onPress={() => onSelect?.(i)} hitSlop={4}>
            <View style={styles.miniBarWrap}>
              <View
                style={{
                  width: "100%",
                  borderRadius: 4,
                  backgroundColor: d.value > 0 ? (dim ? alpha(color, 0.25) : color) : track,
                  height: d.value > 0 ? `${Math.max(6, (d.value / max) * 100)}%` : 4,
                }}
              />
            </View>
            <Text
              style={[styles.miniLabel, selected === i && { color, fontWeight: "800" }]}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OverviewContent() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const { appointments: allAppointments, loading, reload } = useAppointments();
  const { entries: waitlist, reload: reloadWaitlist } = useWaitlistEntries();
  const { isStaff, staffId } = useStaffRoleContext();
  const router = useRouter();

  const now = tashkentClock.now();
  const today = now.dateStr;

  // Shifokor uchun boshqaruv paneli faqat uning o'z bronlaridan tuziladi
  const appointments = useMemo(
    () =>
      isStaff && staffId ? allAppointments.filter((a) => a.staff_id === staffId) : allAppointments,
    [allAppointments, isStaff, staffId]
  );

  const todays = useMemo(
    () =>
      appointments
        .filter((a) => a.booking_date === today)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments, today]
  );

  const stats = useMemo(() => {
    const todayActive = todays.filter((a) => a.status !== "cancelled");
    const earnings = todayActive.reduce((sum, a) => sum + (a.price || 0), 0);
    const upcoming = appointments.filter(
      (a) => a.status === "upcoming" && a.booking_date >= today
    ).length;
    const activeWaitlist = waitlist.filter(
      (w) => w.status === "waiting" || w.status === "notified"
    ).length;
    return { todayCount: todayActive.length, earnings, upcoming, activeWaitlist };
  }, [todays, appointments, waitlist, today]);

  // ── Statistika bo'limi hisob-kitoblari ──
  const todaySlots = useTodaySlots(today, isStaff ? staffId : null);

  // Bugungi bandlik: band daqiqalar / jadvaldagi ochiq daqiqalar
  const occupancy = useMemo(() => {
    const availMin = todaySlots.reduce(
      (s, sl) => s + Math.max(0, toMin(sl.end_time) - toMin(sl.start_time)),
      0
    );
    if (availMin <= 0) return null;
    const bookedMin = todays
      .filter((a) => a.status !== "cancelled")
      .reduce((s, a) => s + (a.duration_minutes || Math.max(0, toMin(a.end_time) - toMin(a.start_time))), 0);
    return Math.min(100, Math.round((bookedMin / availMin) * 100));
  }, [todaySlots, todays]);

  const monthStats = useMemo(() => {
    const ym = today.slice(0, 7); // "2026-07"
    const dayN = Number(today.slice(8, 10));
    const [yy, mm] = ym.split("-").map(Number);
    const prevYm = mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`;

    const inMonth = appointments.filter((a) => a.booking_date.startsWith(ym));
    const active = inMonth.filter((a) => a.status !== "cancelled");
    const completedM = inMonth.filter((a) => a.status === "completed");
    const cancelledCount = inMonth.length - active.length;

    const revenue = completedM.reduce((s, a) => s + (a.price || 0), 0);
    // Adolatli taqqoslash: o'tgan oyning ham faqat 1..bugungi kun oralig'i olinadi
    const prevRevenue = appointments
      .filter(
        (a) =>
          a.status === "completed" &&
          a.booking_date.startsWith(prevYm) &&
          Number(a.booking_date.slice(8, 10)) <= dayN
      )
      .reduce((s, a) => s + (a.price || 0), 0);
    const change = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

    const clients = new Set(active.map((a) => a.client_id)).size;
    const cancelRate = inMonth.length > 0 ? Math.round((cancelledCount / inMonth.length) * 100) : 0;

    // Oxirgi 7 kun daromadi (yakunlangan bronlar)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDaysStr(today, i - 6);
      const dayBk = appointments.filter((a) => a.booking_date === d);
      const v = dayBk
        .filter((a) => a.status === "completed")
        .reduce((s, a) => s + (a.price || 0), 0);
      return {
        date: d,
        label: String(Number(d.slice(8, 10))),
        value: v,
        count: dayBk.filter((a) => a.status !== "cancelled").length,
      };
    });
    const weekTotal = week.reduce((s, d) => s + d.value, 0);
    const weekCount = week.reduce((s, d) => s + d.count, 0);

    // Rekord kun — eng yuqori kunlik daromad (butun tarix bo'yicha)
    const byDay = new Map<string, number>();
    appointments.forEach((a) => {
      if (a.status === "completed" && a.price)
        byDay.set(a.booking_date, (byDay.get(a.booking_date) || 0) + a.price);
    });
    let recordDate: string | null = null;
    let recordSum = 0;
    byDay.forEach((v, d) => {
      if (v > recordSum) {
        recordSum = v;
        recordDate = d;
      }
    });

    // Bu oy eng ko'p kelgan mijozlar
    const byClient = new Map<string, { count: number; spend: number; client: Appointment["client"] }>();
    active.forEach((a) => {
      const cur = byClient.get(a.client_id) || { count: 0, spend: 0, client: a.client };
      cur.count += 1;
      cur.spend += a.price || 0;
      if (!cur.client) cur.client = a.client;
      byClient.set(a.client_id, cur);
    });
    const topClients = [...byClient.values()]
      .sort((x, y) => y.count - x.count || y.spend - x.spend)
      .slice(0, 3);

    return {
      revenue,
      change,
      clients,
      bookings: active.length,
      cancelledCount,
      cancelRate,
      week,
      weekTotal,
      weekCount,
      recordDate,
      recordSum,
      topClients,
    };
  }, [appointments, today]);

  // Oylik kalendar (heatmap) oynasi
  const [calOpen, setCalOpen] = useState(false);

  // Grafikda tanlangan kun (Screen Time uslubi)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const selDay = selectedDayIdx != null ? monthStats.week[selectedDayIdx] : null;
  const selBookings = useMemo(
    () =>
      selDay
        ? appointments
            .filter((a) => a.booking_date === selDay.date)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        : [],
    [appointments, selDay]
  );

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => {
        reload();
        reloadWaitlist();
      }}
    >
      {/* Sarlavha + tezkor tugmalar */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("pv.nav_dashboard")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Statistika — egada butun biznes, shifokorda faqat o'z bronlari
              kesimida hisoblanadi (useProviderStats staff_id bo'yicha filtrlaydi) */}
          <GlassIconButton onPress={() => router.push("/stats")}>
            <BarChart3 size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <GlassIconButton onPress={() => router.push("/settings")}>
            <Settings size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
        </View>
      </View>

      {/* Zumrad hero — kunning bosh raqami: bugungi daromad */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t("pv.stat_earnings")}</Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {stats.earnings > 0 ? formatSom(stats.earnings) : "0"}
          </Text>
          <Text style={styles.heroSuffix}>{t("pv.som")}</Text>
        </View>
        <View style={styles.heroChip}>
          <CalendarDays size={13} color={colors.onPrimary} />
          <Text style={styles.heroChipText}>{t("pv.hero_bookings", { n: stats.todayCount })}</Text>
        </View>
      </View>

      {/* Ixcham statlar */}
      <View style={styles.chipRow}>
        <GlassSurface style={styles.chip} fallbackStyle={styles.chipFallback}>
          <View style={styles.chipIcon}>
            <CalendarClock size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chipValue}>{stats.upcoming}</Text>
            <Text style={styles.chipLabel} numberOfLines={1}>
              {t("pv.stat_upcoming")}
            </Text>
          </View>
        </GlassSurface>
        {/* Navbat — butun biznesga tegishli, shifokorda ko'rsatilmaydi */}
        {!isStaff && (
          <GlassSurface style={styles.chip} fallbackStyle={styles.chipFallback}>
            <View style={[styles.chipIcon, { backgroundColor: alpha(colors.secondaryContainer, 0.18) }]}>
              <Hourglass size={16} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.chipValue}>{stats.activeWaitlist}</Text>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {t("pv.stat_waitlist")}
              </Text>
            </View>
          </GlassSurface>
        )}
      </View>

      {/* ── Statistika ── Spinner faqat birinchi yuklanishda; refresh'da tepadagi logo yetadi */}
      {loading && appointments.length === 0 ? (
        <Spinner />
      ) : (
      <View style={{ gap: 12 }}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t("pv.stats_title")}</Text>
          <Pressable onPress={() => router.push("/stats")}>
            <Text style={styles.viewAll}>{t("pv.view_all")} →</Text>
          </Pressable>
        </View>

        {/* Oylik hisobot */}
        <GlassSurface style={styles.monthCard} fallbackStyle={styles.monthCardFallback}>
          <View style={styles.monthTopRow}>
            <Text style={styles.monthLabel}>{t("pv.month_title")}</Text>
            {monthStats.change !== null ? (
              <View
                style={[
                  styles.changeBadge,
                  {
                    backgroundColor:
                      monthStats.change >= 0 ? alpha(colors.primaryContainer, 0.25) : alpha(colors.errorContainer, 0.3),
                  },
                ]}
              >
                {monthStats.change >= 0 ? (
                  <TrendingUp size={12} color={colors.primary} />
                ) : (
                  <TrendingDown size={12} color={colors.error} />
                )}
                <Text
                  style={[
                    styles.changeBadgeText,
                    { color: monthStats.change >= 0 ? colors.primary : colors.error },
                  ]}
                >
                  {Math.abs(monthStats.change)}%
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.monthValueRow}>
            <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit>
              {monthStats.revenue > 0 ? formatSom(monthStats.revenue) : "0"}
            </Text>
            <Text style={styles.monthSuffix}>{t("pv.som")}</Text>
          </View>
          {monthStats.change !== null ? (
            <Text style={styles.monthVsPrev}>{t("pv.month_vs_prev")}</Text>
          ) : null}
          <View style={styles.monthMetaRow}>
            <View style={styles.monthMeta}>
              <Users size={14} color={colors.onSurfaceVariant} />
              <Text style={styles.monthMetaValue}>{monthStats.clients}</Text>
              <Text style={styles.monthMetaLabel}>{t("stats.clients")}</Text>
            </View>
            <View style={styles.monthMetaDivider} />
            <View style={styles.monthMeta}>
              <CalendarDays size={14} color={colors.onSurfaceVariant} />
              <Text style={styles.monthMetaValue}>{monthStats.bookings}</Text>
              <Text style={styles.monthMetaLabel}>{t("stats.bookings")}</Text>
            </View>
          </View>
        </GlassSurface>

        {/* Mini ko'rsatkichlar: bandlik / bekor qilish / rekord */}
        <View style={styles.tileRow}>
          <GlassSurface style={styles.tile} fallbackStyle={styles.tileFallback}>
            <ProgressRing
              size={44}
              progress={(occupancy ?? 0) / 100}
              color={colors.primary}
              track={alpha(colors.outlineVariant, 0.6)}
            >
              <Text style={styles.ringText}>{occupancy !== null ? `${occupancy}%` : "—"}</Text>
            </ProgressRing>
            <Text style={styles.tileLabel} numberOfLines={2}>
              {t("pv.occupancy_today")}
            </Text>
          </GlassSurface>

          <GlassSurface style={styles.tile} fallbackStyle={styles.tileFallback}>
            <Text
              style={[
                styles.tileValue,
                { color: monthStats.cancelRate > 20 ? colors.error : colors.onSurface },
              ]}
            >
              {monthStats.cancelRate}%
            </Text>
            <Text style={styles.tileSub}>{t("pv.n_bookings", { n: monthStats.cancelledCount })}</Text>
            <Text style={styles.tileLabel} numberOfLines={2}>
              {t("pv.cancel_rate")}
            </Text>
          </GlassSurface>

          <GlassSurface style={styles.tile} fallbackStyle={styles.tileFallback}>
            <View style={styles.tileIconRow}>
              <Trophy size={14} color={colors.secondary} />
              <Text style={styles.tileValueSm} numberOfLines={1} adjustsFontSizeToFit>
                {monthStats.recordSum > 0 ? formatSom(monthStats.recordSum) : "—"}
              </Text>
            </View>
            {monthStats.recordDate ? (
              <Text style={styles.tileSub}>{formatUzDate(monthStats.recordDate)}</Text>
            ) : null}
            <Text style={styles.tileLabel} numberOfLines={2}>
              {t("pv.record_day")}
            </Text>
          </GlassSurface>
        </View>

        {/* 7 kunlik daromad — ustunni bosib kunni tanlash mumkin */}
        <GlassSurface style={styles.chartCard} fallbackStyle={styles.tileFallback}>
          <Pressable style={styles.chartTopRow} onPress={() => setCalOpen(true)}>
            <Text style={styles.chartTitle}>{t("pv.week_revenue")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={styles.chartTotal}>
                {selDay
                  ? formatUzDate(selDay.date)
                  : `${formatUzDate(monthStats.week[0].date)} – ${formatUzDate(monthStats.week[6].date)}`}
              </Text>
              <ChevronRight size={14} color={colors.primary} />
            </View>
          </Pressable>

          {/* Xulosa: tanlangan kun yoki butun hafta — daromad va bronlar soni */}
          <View style={styles.dayDetail}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={styles.dayDetailSum} numberOfLines={1} adjustsFontSizeToFit>
                {selDay
                  ? selDay.value > 0
                    ? formatSom(selDay.value)
                    : "0"
                  : monthStats.weekTotal > 0
                    ? formatSom(monthStats.weekTotal)
                    : "0"}
              </Text>
              <Text style={styles.dayDetailSuffix}>{t("pv.som")}</Text>
            </View>
            <Text style={styles.dayDetailSub}>
              {t("pv.n_bookings", { n: selDay ? selDay.count : monthStats.weekCount })}
            </Text>
          </View>

          <MiniBars
            data={monthStats.week}
            color={colors.primary}
            track={alpha(colors.outlineVariant, 0.6)}
            selected={selectedDayIdx}
            onSelect={(i) => setSelectedDayIdx((cur) => (cur === i ? null : i))}
          />

          {/* Tanlangan kunning bronlari */}
          {selDay && selBookings.length > 0 ? (
            <View style={styles.dayList}>
              {selBookings.map((a) => {
                const cancelled = a.status === "cancelled";
                return (
                  <View key={a.id} style={styles.dayRow}>
                    <Text style={styles.dayRowTime}>{hhmm(a.start_time)}</Text>
                    <Text
                      style={[
                        styles.dayRowName,
                        cancelled && {
                          textDecorationLine: "line-through",
                          color: colors.onSurfaceVariant,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {a.client?.full_name || "—"}
                    </Text>
                    <Text style={[styles.dayRowPrice, cancelled && { color: colors.error }]}>
                      {cancelled
                        ? t("pv.status_cancelled")
                        : a.price
                          ? formatSom(a.price)
                          : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </GlassSurface>

        {/* Top mijozlar */}
        {monthStats.topClients.length > 0 ? (
          <GlassSurface style={styles.chartCard} fallbackStyle={styles.tileFallback}>
            <Text style={styles.chartTitle}>{t("pv.top_clients")}</Text>
            {monthStats.topClients.map((c, i) => (
              <View key={i} style={[styles.topRow, i > 0 && styles.topRowBorder]}>
                <Text style={styles.topRank}>{i + 1}</Text>
                <ClientAvatar name={c.client?.full_name || null} avatarUrl={c.client?.avatar_url} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.apptName} numberOfLines={1}>
                    {c.client?.full_name || "—"}
                  </Text>
                  <Text style={styles.apptService}>{t("pv.n_bookings", { n: c.count })}</Text>
                </View>
                {c.spend > 0 ? (
                  <Text style={styles.topSpend}>{formatSom(c.spend)}</Text>
                ) : null}
              </View>
            ))}
          </GlassSurface>
        ) : null}
      </View>
      )}

      {/* Oylik kalendar — kunlar heatmap, kun tanlansa tafsilotlar */}
      <MonthOverviewModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        appointments={appointments}
        today={today}
      />
    </Screen>
  );
}

export default function OverviewScreen() {
  return (
    <BusinessGate>
      <OverviewContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    title: { fontSize: 24, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },

    hero: { backgroundColor: colors.primary, borderRadius: radius.xxxl, padding: 20 },
    heroLabel: { fontSize: 13, fontWeight: "600", color: alpha(colors.onPrimary, 0.75) },
    heroValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 },
    heroValue: {
      fontSize: 40,
      fontWeight: "800",
      color: colors.onPrimary,
      letterSpacing: -1.2,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    heroSuffix: { fontSize: 15, fontWeight: "700", color: alpha(colors.onPrimary, 0.75) },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: alpha(colors.onPrimary, 0.14),
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginTop: 12,
    },
    heroChipText: { fontSize: 12, fontWeight: "600", color: colors.onPrimary },

    chipRow: { flexDirection: "row", gap: 12 },
    chip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: radius.xl,
      padding: 12,
      overflow: "hidden",
    },
    chipFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    chipIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(colors.primaryContainer, 0.16),
    },
    chipValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.onSurface,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    chipLabel: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },

    apptName: { fontWeight: "600", fontSize: 14, color: colors.onSurface },
    apptService: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 },

    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.3 },
    viewAll: { color: colors.primary, fontSize: 13, fontWeight: "600" },

    // ── Statistika bo'limi ──
    monthCard: { borderRadius: radius.xxxl, padding: 16, overflow: "hidden" },
    monthCardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    monthTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    changeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    changeBadgeText: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
    monthValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
    monthValue: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.8,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    monthSuffix: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceVariant },
    monthVsPrev: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
    monthMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
    },
    monthMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    monthMetaValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
    },
    monthMetaLabel: { fontSize: 12, color: colors.onSurfaceVariant },
    monthMetaDivider: { width: 1, height: 16, backgroundColor: colors.outlineVariant },

    tileRow: { flexDirection: "row", gap: 12 },
    tile: {
      flex: 1,
      borderRadius: radius.xl,
      padding: 12,
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
    },
    tileFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    ringText: { fontSize: 11, fontWeight: "800", color: colors.onSurface, fontVariant: ["tabular-nums"] },
    tileValue: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    tileValueSm: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    tileIconRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44 },
    tileSub: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: "600" },
    tileLabel: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      textAlign: "center",
      fontWeight: "500",
    },

    chartCard: { borderRadius: radius.xl, padding: 16, overflow: "hidden" },
    chartTopRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 12,
    },
    chartTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.2 },
    chartTotal: { fontSize: 12, fontWeight: "700", color: colors.primary, fontVariant: ["tabular-nums"] },
    dayDetail: { marginBottom: 12 },
    dayDetailSum: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.6,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    dayDetailSuffix: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceVariant },
    dayDetailSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600", marginTop: 2 },

    dayList: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
    },
    dayRowTime: {
      width: 44,
      fontSize: 12,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      fontVariant: ["tabular-nums"],
    },
    dayRowName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.onSurface },
    dayRowPrice: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },

    miniChart: { flexDirection: "row", alignItems: "flex-end", height: 72, gap: 6 },
    miniCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
    miniBarWrap: { flex: 1, width: "100%", justifyContent: "flex-end" },
    miniLabel: { fontSize: 9, fontWeight: "600", color: colors.onSurfaceVariant },

    topRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    topRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
    topRank: {
      width: 20,
      fontSize: 13,
      fontWeight: "800",
      color: colors.onSurfaceVariant,
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
    topSpend: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
  })
);
