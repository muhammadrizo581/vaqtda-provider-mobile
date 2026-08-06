// Statistika — _port_reference/stats-page.tsx dan port.
// Davr: Hafta (7 kun) / Oy (30 kun) / Hammasi — qayta so'rovsiz, useMemo bilan.
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Gauge,
  Users,
  Wallet,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { Card, GlassIconButton, GlassSurface, Spinner } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProviderStats } from "@/hooks/useProviderStats";

type Period = "week" | "month" | "all";

// "HH:MM[:SS]" -> daqiqa
function toMin(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Toshkent vaqti bo'yicha YYYY-MM-DD
function tashDate(offsetDays = 0): string {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
}

function fmtUZS(n: number, ru: boolean): string {
  const s = new Intl.NumberFormat(ru ? "ru-RU" : "en-US")
    .format(Math.round(n))
    .replace(/,/g, " ");
  return `${s} ${ru ? "сум" : "so'm"}`;
}

// Kichik vertikal bar grafik
function BarChart({ data, color }: { data: { label: string; value: number }[]; color?: string }) {
  const colors = useColors();
  const styles = useStyles();
  const barColor = color ?? colors.primary;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.chart}>
      {data.map((d, i) => (
        <View key={i} style={styles.chartCol}>
          <View style={styles.chartBarWrap}>
            <View
              style={{
                width: "100%",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: barColor,
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 4 : 0,
              }}
            />
          </View>
          <Text style={styles.chartLabel} numberOfLines={1}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  const styles = useStyles();
  return (
    <GlassSurface style={styles.kpi} fallbackStyle={styles.kpiFallback}>
      <View style={styles.kpiTop}>
        <View style={styles.kpiIcon}>{icon}</View>
        <Text style={styles.kpiLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </GlassSurface>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, lang } = useLanguage();
  const ru = lang === "ru";
  const router = useRouter();
  const { loading, bookings, slots } = useProviderStats();
  // Shifokor uchun raqamlar faqat uning o'z bronlaridan olinadi (hook'da
  // staff_id bo'yicha filtrlangan) — buni ekranda ham eslatib qo'yamiz
  const { isStaff } = useStaffRoleContext();
  const [period, setPeriod] = useState<Period>("month");

  const stats = useMemo(() => {
    const wdShort = ru
      ? ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
      : ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    const today = tashDate(0);
    const days = period === "week" ? 7 : 30;
    const start = period === "all" ? "0000-01-01" : tashDate(-(days - 1));
    const inPeriod = (d: string) => d >= start && d <= today;

    const periodBk = bookings.filter((b) => inPeriod(b.booking_date));
    const nonCancelled = periodBk.filter((b) => b.status !== "cancelled");
    const completed = periodBk.filter((b) => b.status === "completed");
    const cancelled = periodBk.filter((b) => b.status === "cancelled");
    const upcoming = periodBk.filter((b) => b.status === "upcoming" || b.status === "pending");

    const revenue = completed.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const clients = new Set(nonCancelled.map((b) => b.client_id)).size;

    const bookedMin = nonCancelled.reduce((s, b) => s + (b.duration_minutes || 0), 0);
    const availMin = slots
      .filter((s) => inPeriod(s.slot_date))
      .reduce((s, sl) => s + Math.max(0, toMin(sl.end_time) - toMin(sl.start_time)), 0);
    const occupancy = availMin > 0 ? Math.min(100, Math.round((bookedMin / availMin) * 100)) : null;

    // Trend: oxirgi N kun bo'yicha bronlar (bekor qilinmagan)
    const trendDays = period === "week" ? 7 : 30;
    const counts: Record<string, number> = {};
    nonCancelled.forEach((b) => {
      counts[b.booking_date] = (counts[b.booking_date] || 0) + 1;
    });
    const trend = Array.from({ length: trendDays }, (_, i) => {
      const d = tashDate(-(trendDays - 1 - i));
      const dd = d.slice(8, 10);
      return { label: trendDays > 14 && i % 3 !== 0 ? "" : dd, value: counts[d] || 0 };
    });

    // Hafta kunlari bo'yicha
    const byWd = Array(7).fill(0);
    nonCancelled.forEach((b) => {
      const wd = new Date(`${b.booking_date}T00:00:00`).getDay();
      byWd[wd] += 1;
    });
    const wdOrder = [1, 2, 3, 4, 5, 6, 0];
    const weekday = wdOrder.map((wd) => ({ label: wdShort[wd], value: byWd[wd] }));

    // Band soatlar
    const byHour: Record<number, number> = {};
    nonCancelled.forEach((b) => {
      const h = Math.floor(toMin(b.start_time) / 60);
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const hoursPresent = Object.keys(byHour).map(Number);
    const minH = hoursPresent.length ? Math.min(...hoursPresent) : 9;
    const maxH = hoursPresent.length ? Math.max(...hoursPresent) : 18;
    const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => {
      const h = minH + i;
      return { label: `${h}`, value: byHour[h] || 0 };
    });

    return {
      revenue,
      clients,
      total: periodBk.length,
      completed: completed.length,
      cancelled: cancelled.length,
      upcoming: upcoming.length,
      occupancy,
      trend,
      weekday,
      hours,
      hasData: periodBk.length > 0,
    };
  }, [bookings, slots, period, ru]);

  const periods: { key: Period; label: string }[] = [
    { key: "week", label: t("stats.period_week") },
    { key: "month", label: t("stats.period_month") },
    { key: "all", label: t("stats.period_all") },
  ];

  return (
    <Screen>
      {/* Sarlavha + davr almashtirgich */}
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={styles.titleIcon}>
          <BarChart3 size={18} color={colors.primary} />
        </View>
        <Text style={styles.title}>{isStaff ? t("stf.my_stats") : t("stats.title")}</Text>
      </View>

      {/* Shifokorga: raqamlar faqat uning bronlari bo'yicha */}
      {isStaff ? <Text style={styles.scopeNote}>{t("stf.my_stats_note")}</Text> : null}

      {/* Davr almashtirgich — shisha segment konteyner */}
      <GlassSurface style={styles.periodRow} fallbackStyle={styles.periodRowFallback}>
        {periods.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)}>
            <GlassSurface
              style={styles.periodBtn}
              fallbackStyle={period === p.key ? { backgroundColor: colors.primary } : undefined}
              tintColor={period === p.key ? colors.primary : undefined}
              interactive
            >
              <Text
                style={[
                  styles.periodText,
                  { color: period === p.key ? colors.onPrimary : colors.onSurfaceVariant },
                ]}
              >
                {p.label}
              </Text>
            </GlassSurface>
          </Pressable>
        ))}
      </GlassSurface>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* KPI kartalar */}
          <View style={styles.kpiGrid}>
            <KpiCard
              icon={<Wallet size={14} color={colors.primary} />}
              label={t("stats.revenue")}
              value={fmtUZS(stats.revenue, ru)}
              sub={`${stats.completed} ${t("stats.completed").toLowerCase()}`}
            />
            <KpiCard
              icon={<CalendarCheck size={14} color={colors.primary} />}
              label={t("stats.bookings")}
              value={String(stats.total)}
              sub={`${stats.upcoming} ${t("stats.upcoming").toLowerCase()}`}
            />
            <KpiCard
              icon={<CheckCircle2 size={14} color={colors.primary} />}
              label={t("stats.completed")}
              value={String(stats.completed)}
              sub={`${stats.cancelled} ${t("stats.cancelled").toLowerCase()}`}
            />
            <KpiCard
              icon={<Users size={14} color={colors.primary} />}
              label={t("stats.clients")}
              value={String(stats.clients)}
            />
            {stats.occupancy !== null && (
              <KpiCard
                icon={<Gauge size={14} color={colors.primary} />}
                label={t("stats.occupancy")}
                value={`${stats.occupancy}%`}
              />
            )}
          </View>

          {!stats.hasData ? (
            <Card style={{ padding: 40 }}>
              <Text style={styles.emptyText}>{t("stats.empty")}</Text>
            </Card>
          ) : (
            <>
              <Card style={{ padding: 16 }}>
                <Text style={styles.chartTitle}>{t("stats.trend_title")}</Text>
                <BarChart data={stats.trend} />
              </Card>
              <Card style={{ padding: 16 }}>
                <Text style={styles.chartTitle}>{t("stats.by_weekday")}</Text>
                <BarChart data={stats.weekday} color={alpha(colors.primary, 0.8)} />
              </Card>
              <Card style={{ padding: 16 }}>
                <Text style={styles.chartTitle}>{t("stats.by_hour")}</Text>
                <BarChart data={stats.hours} color={colors.secondary} />
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIcon: {
    padding: 10,
    borderRadius: radius.xl,
    backgroundColor: alpha(colors.primary, 0.1),
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  scopeNote: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: -4 },

  periodRow: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  periodRowFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: "hidden" },
  periodText: { fontSize: 12, fontWeight: "700" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpi: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: radius.xl,
    padding: 16,
    overflow: "hidden",
  },
  kpiFallback: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  kpiTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  kpiIcon: { borderRadius: radius.md, backgroundColor: alpha(colors.primary, 0.1), padding: 6 },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  kpiValue: { marginTop: 8, fontSize: 22, fontWeight: "800", color: colors.onSurface },
  kpiSub: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant, marginTop: 2 },

  emptyText: { textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.onSurfaceVariant },

  chartTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface, marginBottom: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 128, gap: 2 },
  chartCol: { flex: 1, alignItems: "center", gap: 4, minWidth: 0, height: "100%" },
  chartBarWrap: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textAlign: "center",
    width: "100%",
  },
}));
