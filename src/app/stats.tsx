// Statistika va Tahlil (Analytics) — biznesning barcha ko'rsatkichlari,
// daromad dinamikasi, mijozlar oqimi, xizmatlar va xodimlar reytingi.
// Shifokor/usta kirsa faqat uning o'ziga tegishli bronlar hisoblanadi.
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  CalendarCheck,
  Clock,
  Gauge,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { ClientAvatar, GlassIconButton, GlassSurface, Spinner } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProviderStats } from "@/hooks/useProviderStats";
import { formatSom } from "@/utils/price";
import { addDaysStr, createTashkentClock, dayDiff, formatUzDate } from "@/utils/tashkent";
import { localize } from "@/utils/localize";

const tashkentClock = createTashkentClock();

type Period = "today" | "week" | "month" | "quarter" | "all";
type ChartMode = "revenue" | "bookings";

// "HH:MM[:SS]" -> daqiqa
function toMin(t?: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const hhmm = (t?: string | null) => (t || "").slice(0, 5);

export default function StatsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const ru = lang === "ru";
  const { isStaff } = useStaffRoleContext();
  const { loading, bookings, slots, reload } = useProviderStats();

  const [period, setPeriod] = useState<Period>("month");
  const [chartMode, setChartMode] = useState<ChartMode>("revenue");
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  const now = tashkentClock.now();
  const today = now.dateStr;

  // Davrlar konfiguratsiyasi
  const periods: { key: Period; label: string }[] = [
    { key: "today", label: ru ? "Сегодня" : "Bugun" },
    { key: "week", label: ru ? "7 дней" : "7 kun" },
    { key: "month", label: ru ? "30 дней" : "30 kun" },
    { key: "quarter", label: ru ? "90 дней" : "90 kun" },
    { key: "all", label: ru ? "Все время" : "Barchasi" },
  ];

  // Asosiy hisob-kitoblar va agregatsiyalar
  const data = useMemo(() => {
    const days =
      period === "today"
        ? 1
        : period === "week"
        ? 7
        : period === "month"
        ? 30
        : period === "quarter"
        ? 90
        : 365;

    const startDate = period === "all" ? "2000-01-01" : addDaysStr(today, -(days - 1));
    const inCurrentPeriod = (d: string) => d >= startDate && d <= today;

    // Oldingi teng davr (taqqoslash uchun: o'sish/pasayish %)
    const prevStartDate = period === "all" ? "1990-01-01" : addDaysStr(startDate, -days);
    const inPrevPeriod = (d: string) => d >= prevStartDate && d < startDate;

    const currentBookings = bookings.filter((b) => inCurrentPeriod(b.booking_date));
    const prevBookings = bookings.filter((b) => inPrevPeriod(b.booking_date));

    // Joriy davr bo'yicha statuslar
    const completed = currentBookings.filter((b) => b.status === "completed");
    const cancelled = currentBookings.filter((b) => b.status === "cancelled");
    const upcoming = currentBookings.filter(
      (b) => b.status === "upcoming" || b.status === "pending"
    );
    const nonCancelled = currentBookings.filter((b) => b.status !== "cancelled");

    // Daromad
    const revenue = completed.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
    const prevRevenue = prevBookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    const revenueGrowth =
      prevRevenue > 0
        ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
        : null;

    // Bronlar o'sishi
    const bookingsGrowth =
      prevBookings.length > 0
        ? Math.round(((currentBookings.length - prevBookings.length) / prevBookings.length) * 100)
        : null;

    // O'rtacha chek (AOV)
    const avgCheck = completed.length > 0 ? Math.round(revenue / completed.length) : 0;

    // Kunlik o'rtacha tushum — davrdagi kunlar soniga bo'linadi. "Barchasi"da
    // birinchi brondan bugungacha o'tgan kunlar olinadi.
    const firstDate = bookings.reduce<string | null>(
      (min, b) => (!min || b.booking_date < min ? b.booking_date : min),
      null
    );
    const spanDays =
      period === "all" ? (firstDate && firstDate <= today ? dayDiff(firstDate, today) + 1 : 1) : days;
    const avgDailyRevenue = Math.round(revenue / Math.max(1, spanDays));

    // Mijozlar: Unikal, Yangi va Qaytgan
    const currentClients = new Set(nonCancelled.map((b) => b.client_id));
    const totalClientsCount = currentClients.size;

    // Barcha davrlardagi mijozlar tarixi (yangi vs qaytgan)
    const allPriorBookings = bookings.filter((b) => b.booking_date < startDate && b.status !== "cancelled");
    const priorClients = new Set(allPriorBookings.map((b) => b.client_id));

    let newClientsCount = 0;
    let returningClientsCount = 0;
    currentClients.forEach((cid) => {
      if (priorClients.has(cid)) {
        returningClientsCount += 1;
      } else {
        newClientsCount += 1;
      }
    });

    const returningRate = totalClientsCount > 0 ? Math.round((returningClientsCount / totalClientsCount) * 100) : 0;

    // Konversiya va Bekor qilish foizlari
    const completionRate =
      currentBookings.length > 0
        ? Math.round((completed.length / currentBookings.length) * 100)
        : 0;
    const cancelRate =
      currentBookings.length > 0
        ? Math.round((cancelled.length / currentBookings.length) * 100)
        : 0;

    // Bandlik darajasi (Occupancy)
    const periodSlots = slots.filter((s) => inCurrentPeriod(s.slot_date));
    const availMin = periodSlots.reduce(
      (s, sl) => s + Math.max(0, toMin(sl.end_time) - toMin(sl.start_time)),
      0
    );
    const bookedMin = nonCancelled.reduce((s, b) => s + (b.duration_minutes || 60), 0);
    const occupancy = availMin > 0 ? Math.min(100, Math.round((bookedMin / availMin) * 100)) : null;

    // ─── KUNMA-KUN TREND GRAFIGI ────────────────────────────
    const trendDayCount = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 14;
    const trendDates = Array.from({ length: trendDayCount }, (_, i) => {
      return addDaysStr(today, -(trendDayCount - 1 - i));
    });

    const dailyStats: Record<string, { revenue: number; bookings: number; completed: number; cancelled: number }> = {};
    trendDates.forEach((d) => {
      dailyStats[d] = { revenue: 0, bookings: 0, completed: 0, cancelled: 0 };
    });

    currentBookings.forEach((b) => {
      if (dailyStats[b.booking_date]) {
        dailyStats[b.booking_date].bookings += 1;
        if (b.status === "completed") {
          dailyStats[b.booking_date].completed += 1;
          dailyStats[b.booking_date].revenue += Number(b.price) || 0;
        } else if (b.status === "cancelled") {
          dailyStats[b.booking_date].cancelled += 1;
        }
      }
    });

    const trendChart = trendDates.map((dateStr) => {
      const st = dailyStats[dateStr];
      const dayNum = Number(dateStr.slice(8, 10));
      return {
        date: dateStr,
        label: trendDayCount > 14 && dayNum % 3 !== 0 ? "" : String(dayNum),
        revenue: st.revenue,
        bookings: st.bookings,
        completed: st.completed,
        cancelled: st.cancelled,
      };
    });

    // ─── HAFTA KUNLARI TAHLILI ──────────────────────────────
    const wdShort = ru
      ? ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
      : ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    const byWdRevenue = Array(7).fill(0);
    const byWdCount = Array(7).fill(0);

    nonCancelled.forEach((b) => {
      const wd = new Date(`${b.booking_date}T00:00:00`).getDay();
      byWdCount[wd] += 1;
      if (b.status === "completed") {
        byWdRevenue[wd] += Number(b.price) || 0;
      }
    });

    // Dushanbadan boshlanadigan tartib [1..6, 0]
    const wdOrder = [1, 2, 3, 4, 5, 6, 0];
    const weekdayStats = wdOrder.map((wd) => ({
      label: wdShort[wd],
      count: byWdCount[wd],
      revenue: byWdRevenue[wd],
    }));

    // Eng gavjum hafta kuni
    let maxWdIndex = 0;
    weekdayStats.forEach((w, idx) => {
      if (w.count > weekdayStats[maxWdIndex].count) maxWdIndex = idx;
    });
    const peakWeekday = weekdayStats[maxWdIndex]?.count > 0 ? weekdayStats[maxWdIndex].label : null;

    // ─── SOATLAR BO'YICHA TAHLIL (PEAK HOURS) ───────────────
    const byHourCount: Record<number, number> = {};
    nonCancelled.forEach((b) => {
      const h = Math.floor(toMin(b.start_time) / 60);
      if (h >= 6 && h <= 23) {
        byHourCount[h] = (byHourCount[h] || 0) + 1;
      }
    });
    const hoursPresent = Object.keys(byHourCount).map(Number);
    const minH = hoursPresent.length ? Math.min(...hoursPresent) : 9;
    const maxH = hoursPresent.length ? Math.max(...hoursPresent) : 19;
    const hourStats = Array.from({ length: maxH - minH + 1 }, (_, i) => {
      const h = minH + i;
      return {
        hour: h,
        label: `${h}:00`,
        count: byHourCount[h] || 0,
      };
    });

    // Eng qizg'in soat
    let peakHourStr: string | null = null;
    if (hourStats.length > 0) {
      const sortedHours = [...hourStats].sort((a, b) => b.count - a.count);
      if (sortedHours[0].count > 0) {
        peakHourStr = `${sortedHours[0].hour}:00 - ${sortedHours[0].hour + 1}:00`;
      }
    }

    // ─── TOP XIZMATLAR TAHLILI ──────────────────────────────
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    currentBookings.forEach((b) => {
      const rawName = b.service_name || (ru ? "Другая услуга" : "Boshqa xizmat");
      const name = localize(rawName, lang) || (ru ? "Услуга" : "Xizmat");
      const cur = serviceMap.get(name) || { name, count: 0, revenue: 0 };
      if (b.status !== "cancelled") {
        cur.count += 1;
        if (b.status === "completed") {
          cur.revenue += Number(b.price) || 0;
        }
      }
      serviceMap.set(name, cur);
    });

    const topServices = [...serviceMap.values()]
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 5);

    // ─── TOP XODIMLAR / USTALAR TAHLILI ─────────────────────
    const staffMap = new Map<string, { name: string; count: number; revenue: number }>();
    currentBookings.forEach((b) => {
      if (b.staff_name && b.status !== "cancelled") {
        const cur = staffMap.get(b.staff_name) || { name: b.staff_name, count: 0, revenue: 0 };
        cur.count += 1;
        if (b.status === "completed") {
          cur.revenue += Number(b.price) || 0;
        }
        staffMap.set(b.staff_name, cur);
      }
    });
    const staffStats = [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);

    // ─── TOP MIJOZLAR TAHLILI ───────────────────────────────
    const clientMap = new Map<
      string,
      { id: string; name: string; avatar: string | null; count: number; spend: number }
    >();
    currentBookings.forEach((b) => {
      if (b.status !== "cancelled") {
        const cur = clientMap.get(b.client_id) || {
          id: b.client_id,
          name: b.client_name || (ru ? "Клиент" : "Mijoz"),
          avatar: b.client_avatar,
          count: 0,
          spend: 0,
        };
        cur.count += 1;
        if (b.status === "completed") {
          cur.spend += Number(b.price) || 0;
        }
        clientMap.set(b.client_id, cur);
      }
    });
    const topClients = [...clientMap.values()]
      .sort((a, b) => b.spend - a.spend || b.count - a.count)
      .slice(0, 5);

    // ─── REKORD KUN ─────────────────────────────────────────
    const byDayRevenue = new Map<string, number>();
    bookings.forEach((b) => {
      if (b.status === "completed" && b.price) {
        byDayRevenue.set(b.booking_date, (byDayRevenue.get(b.booking_date) || 0) + Number(b.price));
      }
    });
    let recordDate: string | null = null;
    let recordAmount = 0;
    byDayRevenue.forEach((amt, d) => {
      if (amt > recordAmount) {
        recordAmount = amt;
        recordDate = d;
      }
    });

    return {
      hasData: currentBookings.length > 0,
      currentBookings,
      revenue,
      revenueGrowth,
      bookingsGrowth,
      totalBookings: currentBookings.length,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      upcomingCount: upcoming.length,
      completionRate,
      cancelRate,
      totalClientsCount,
      newClientsCount,
      returningClientsCount,
      returningRate,
      avgCheck,
      avgDailyRevenue,
      occupancy,
      trendChart,
      weekdayStats,
      peakWeekday,
      hourStats,
      peakHourStr,
      topServices,
      staffStats,
      topClients,
      recordDate,
      recordAmount,
    };
  }, [bookings, slots, period, today, ru, lang]);

  // Tanlangan kundagi bronlar ro'yxati
  const selectedDayBookings = useMemo(() => {
    if (!selectedDayDate) return [];
    return data.currentBookings
      .filter((b) => b.booking_date === selectedDayDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [data.currentBookings, selectedDayDate]);

  // Tanlangan kun tafsiloti
  const selectedDayDetail = useMemo(() => {
    if (!selectedDayDate) return null;
    return data.trendChart.find((t) => t.date === selectedDayDate) || null;
  }, [data.trendChart, selectedDayDate]);

  // Bar grafik uchun maksimal qiymat
  const chartMaxValue = useMemo(() => {
    if (chartMode === "revenue") {
      return Math.max(1, ...data.trendChart.map((d) => d.revenue));
    }
    return Math.max(1, ...data.trendChart.map((d) => d.bookings));
  }, [data.trendChart, chartMode]);

  return (
    <Screen onRefresh={reload}>
      {/* Sarlavha */}
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={styles.titleIcon}>
          <BarChart3 size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {isStaff ? (ru ? "Моя статистика" : "Mening statistikam") : t("stats.title")}
          </Text>
          <Text style={styles.subtitle}>
            {ru ? "Глубокая аналитика и ключевые показатели" : "To'liq tahlil va asosiy ko'rsatkichlar"}
          </Text>
        </View>
      </View>

      {/* Davr filtri (Segmented Pills) */}
      <GlassSurface style={styles.periodRow} fallbackStyle={styles.periodRowFallback}>
        {periods.map((p) => {
          const active = period === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                setPeriod(p.key);
                setSelectedDayDate(null);
              }}
              style={{ flex: 1 }}
            >
              <GlassSurface
                style={styles.periodBtn}
                fallbackStyle={active ? { backgroundColor: colors.primary } : undefined}
                tintColor={active ? colors.primary : undefined}
                interactive
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {p.label}
                </Text>
              </GlassSurface>
            </Pressable>
          );
        })}
      </GlassSurface>

      {loading && bookings.length === 0 ? (
        <Spinner />
      ) : (
        <View style={{ gap: 14 }}>
          {/* 1. ASOSIY HERO: DAROMAD VA O'SISH KO'RSATKICHI */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Wallet size={16} color={alpha(colors.onPrimary, 0.85)} />
                <Text style={styles.heroLabel}>
                  {ru ? "ОБЩИЙ ДОХОД" : "UMUMIY DAROMAD"}
                </Text>
              </View>
              {data.revenueGrowth !== null ? (
                <View
                  style={[
                    styles.growthBadge,
                    {
                      backgroundColor:
                        data.revenueGrowth >= 0
                          ? alpha("#ffffff", 0.22)
                          : alpha(colors.error, 0.35),
                    },
                  ]}
                >
                  {data.revenueGrowth >= 0 ? (
                    <TrendingUp size={12} color="#ffffff" />
                  ) : (
                    <TrendingDown size={12} color="#ffffff" />
                  )}
                  <Text style={styles.growthText}>
                    {data.revenueGrowth >= 0 ? `+${data.revenueGrowth}%` : `${data.revenueGrowth}%`}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.heroAmountRow}>
              <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                {data.revenue > 0 ? formatSom(data.revenue) : "0"}
              </Text>
              <Text style={styles.heroSuffix}>{ru ? "сум" : "so'm"}</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBottomRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatSub}>{ru ? "Средний чек" : "O'rtacha chek"}</Text>
                <Text style={styles.heroStatVal}>
                  {data.avgCheck > 0 ? `${formatSom(data.avgCheck)}` : "—"} {ru ? "сум" : "so'm"}
                </Text>
              </View>
              <View style={styles.heroStatSep} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatSub}>{ru ? "В день в среднем" : "Kunlik o'rtacha"}</Text>
                <Text style={styles.heroStatVal}>
                  {data.avgDailyRevenue > 0 ? `${formatSom(data.avgDailyRevenue)}` : "—"} {ru ? "сум" : "so'm"}
                </Text>
              </View>
            </View>
          </View>

          {/* 2. IXCHAM ASOSIY KPI CHIPLARI */}
          <View style={styles.kpiGrid}>
            {/* Bronlar */}
            <GlassSurface style={styles.kpiCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.kpiTop}>
                <View style={[styles.kpiIconWrap, { backgroundColor: alpha(colors.primaryContainer, 0.25) }]}>
                  <CalendarCheck size={16} color={colors.primary} />
                </View>
                <Text style={styles.kpiTitle} numberOfLines={1}>
                  {ru ? "БРОНИ" : "BRONLAR"}
                </Text>
              </View>
              <Text style={styles.kpiMainNumber}>{data.totalBookings}</Text>
              <Text style={styles.kpiSub}>
                {data.completedCount} {ru ? "завершено" : "yakunlandi"} · {data.upcomingCount} {ru ? "ожидается" : "kutilmoqda"}
              </Text>
            </GlassSurface>

            {/* Mijozlar */}
            <GlassSurface style={styles.kpiCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.kpiTop}>
                <View style={[styles.kpiIconWrap, { backgroundColor: alpha(colors.secondaryContainer, 0.25) }]}>
                  <Users size={16} color={colors.secondary} />
                </View>
                <Text style={styles.kpiTitle} numberOfLines={1}>
                  {ru ? "КЛИЕНТЫ" : "MIJOZLAR"}
                </Text>
              </View>
              <Text style={styles.kpiMainNumber}>{data.totalClientsCount}</Text>
              <Text style={styles.kpiSub}>
                {data.newClientsCount} {ru ? "новых" : "yangi"} · {data.returningClientsCount} {ru ? "постоянных" : "qaytgan"}
              </Text>
            </GlassSurface>

            {/* Bandlik darajasi */}
            <GlassSurface style={styles.kpiCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.kpiTop}>
                <View style={[styles.kpiIconWrap, { backgroundColor: alpha(colors.tertiaryContainer, 0.25) }]}>
                  <Gauge size={16} color={colors.tertiary} />
                </View>
                <Text style={styles.kpiTitle} numberOfLines={1}>
                  {ru ? "ЗАГРУЗКА" : "BANDLIK"}
                </Text>
              </View>
              <Text style={styles.kpiMainNumber}>
                {data.occupancy !== null ? `${data.occupancy}%` : "—"}
              </Text>
              <Text style={styles.kpiSub}>
                {ru ? "от рабочего графика" : "ish jadvalidan"}
              </Text>
            </GlassSurface>

            {/* Muvaffaqiyat ko'rsatkichi */}
            <GlassSurface style={styles.kpiCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.kpiTop}>
                <View
                  style={[
                    styles.kpiIconWrap,
                    {
                      backgroundColor:
                        data.cancelRate > 15
                          ? alpha(colors.errorContainer, 0.25)
                          : alpha(colors.primaryContainer, 0.25),
                    },
                  ]}
                >
                  <Percent
                    size={16}
                    color={data.cancelRate > 15 ? colors.error : colors.primary}
                  />
                </View>
                <Text style={styles.kpiTitle} numberOfLines={1}>
                  {ru ? "УСПЕШНОСТЬ" : "MUVAFFAQIYAT"}
                </Text>
              </View>
              <Text style={styles.kpiMainNumber}>{data.completionRate}%</Text>
              <Text
                style={[
                  styles.kpiSub,
                  data.cancelRate > 15 && { color: colors.error, fontWeight: "700" },
                ]}
              >
                {data.cancelRate}% {ru ? "отмен" : "bekor"} ({data.cancelledCount})
              </Text>
            </GlassSurface>
          </View>

          {/* 3. DINAMIKA GRAFIGI (INTERAKTIV CHART VA KUN TAFSILOTI) */}
          <GlassSurface style={styles.chartCard} fallbackStyle={styles.kpiFallback}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.cardSectionTitle}>
                  {ru ? "Динамика и активность" : "Dinamika va faollik"}
                </Text>
                <Text style={styles.cardSectionSub}>
                  {ru ? "Нажмите на столбец для просмотра дня" : "Kungi tafsilotni ko'rish uchun ustunni bosing"}
                </Text>
              </View>

              {/* Grafik rejimi: Daromad yoki Bronlar soni */}
              <View style={styles.chartModeRow}>
                <Pressable
                  onPress={() => setChartMode("revenue")}
                  style={[
                    styles.chartModeBtn,
                    chartMode === "revenue" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chartModeBtnText,
                      {
                        color: chartMode === "revenue" ? colors.onPrimary : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {ru ? "Сумма" : "Summa"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setChartMode("bookings")}
                  style={[
                    styles.chartModeBtn,
                    chartMode === "bookings" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chartModeBtnText,
                      {
                        color: chartMode === "bookings" ? colors.onPrimary : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {ru ? "Брони" : "Bronlar"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Tanlangan kunning qisqacha xulosasi */}
            <View style={styles.selectedDayBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selDayDate}>
                  {selectedDayDetail
                    ? formatUzDate(selectedDayDetail.date)
                    : ru
                    ? "Всего за период"
                    : "Davr bo'yicha jami"}
                </Text>
                <Text style={styles.selDayMain}>
                  {selectedDayDetail
                    ? chartMode === "revenue"
                      ? `${formatSom(selectedDayDetail.revenue)} ${ru ? "сум" : "so'm"}`
                      : `${selectedDayDetail.bookings} ${ru ? "броней" : "ta bron"}`
                    : chartMode === "revenue"
                    ? `${formatSom(data.revenue)} ${ru ? "сум" : "so'm"}`
                    : `${data.totalBookings} ${ru ? "броней" : "ta bron"}`}
                </Text>
              </View>
              {selectedDayDate && (
                <Pressable
                  onPress={() => setSelectedDayDate(null)}
                  style={styles.clearDayBtn}
                >
                  <Text style={styles.clearDayText}>
                    {ru ? "Сбросить выбор" : "Filtrni tozalash"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Ustunli grafik */}
            <View style={styles.barChartContainer}>
              {data.trendChart.map((d, idx) => {
                const val = chartMode === "revenue" ? d.revenue : d.bookings;
                const isSelected = selectedDayDate === d.date;
                const isDimmed = selectedDayDate !== null && !isSelected;
                const heightPct = (val / chartMaxValue) * 100;

                return (
                  <Pressable
                    key={d.date}
                    onPress={() =>
                      setSelectedDayDate((cur) => (cur === d.date ? null : d.date))
                    }
                    style={styles.barCol}
                    hitSlop={4}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: val > 0 ? `${Math.max(6, heightPct)}%` : 4,
                            backgroundColor:
                              val > 0
                                ? isDimmed
                                  ? alpha(colors.primary, 0.25)
                                  : isSelected
                                  ? colors.secondary
                                  : colors.primary
                                : alpha(colors.outlineVariant, 0.5),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        isSelected && { color: colors.secondary, fontWeight: "800" },
                      ]}
                      numberOfLines={1}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Tanlangan kun bronlari (Akkordeon uslubida) */}
            {selectedDayDate && (
              <View style={styles.selectedBookingsBlock}>
                <View style={styles.selHeaderRow}>
                  <Text style={styles.selSectionTitle}>
                    {formatUzDate(selectedDayDate)} {ru ? "— список броней" : "— kun bronlari"}
                  </Text>
                  <Text style={styles.selCountBadge}>
                    {selectedDayBookings.length} {ru ? "шт" : "ta"}
                  </Text>
                </View>

                {selectedDayBookings.length === 0 ? (
                  <Text style={styles.noApptsText}>
                    {ru ? "В этот день не было броней" : "Bu kunda bronlar bo'lmagan"}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {selectedDayBookings.map((b) => {
                      const cancelled = b.status === "cancelled";
                      const completed = b.status === "completed";
                      return (
                        <View key={b.id} style={styles.bookingRow}>
                          <View style={styles.bkTimeCol}>
                            <Clock size={12} color={colors.primary} />
                            <Text style={styles.bkTimeText}>{hhmm(b.start_time)}</Text>
                          </View>
                          <ClientAvatar name={b.client_name} avatarUrl={b.client_avatar} size={32} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.bkClientName} numberOfLines={1}>
                              {b.client_name || (ru ? "Клиент" : "Mijoz")}
                            </Text>
                            <Text style={styles.bkService} numberOfLines={1}>
                              {localize(b.service_name, lang) || (ru ? "Услуга" : "Xizmat")}
                              {b.staff_name ? ` · ${b.staff_name}` : ""}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              style={[
                                styles.bkPrice,
                                cancelled && {
                                  textDecorationLine: "line-through",
                                  color: colors.error,
                                },
                              ]}
                            >
                              {b.price ? `${formatSom(b.price)}` : "—"}
                            </Text>
                            <Text
                              style={[
                                styles.bkStatus,
                                {
                                  color: completed
                                    ? colors.primary
                                    : cancelled
                                    ? colors.error
                                    : colors.secondary,
                                },
                              ]}
                            >
                              {completed
                                ? (ru ? "Завершено" : "Yakunlandi")
                                : cancelled
                                ? (ru ? "Отменено" : "Bekor")
                                : (ru ? "Ожидается" : "Kutilmoqda")}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </GlassSurface>

          {/* 4. HAFTA KUNLARI VA GAVJUM SOATLAR (PEAK HOURS) */}
          <View style={styles.splitRow}>
            {/* Hafta kunlari taqsimoti */}
            <GlassSurface style={styles.halfCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.cardMiniHeader}>
                <Calendar size={15} color={colors.primary} />
                <Text style={styles.miniCardTitle}>
                  {ru ? "Дни недели" : "Hafta kunlari"}
                </Text>
              </View>

              {data.peakWeekday && (
                <View style={styles.highlightPill}>
                  <Sparkles size={11} color={colors.primary} />
                  <Text style={styles.highlightPillText}>
                    {ru ? "Пик:" : "Eng faol:"} {data.peakWeekday}
                  </Text>
                </View>
              )}

              <View style={styles.weekdayChart}>
                {data.weekdayStats.map((w, i) => {
                  const maxW = Math.max(1, ...data.weekdayStats.map((x) => x.count));
                  const isTop = w.label === data.peakWeekday && w.count > 0;
                  return (
                    <View key={i} style={styles.wdCol}>
                      <View style={styles.wdBarTrack}>
                        <View
                          style={[
                            styles.wdBarFill,
                            {
                              height: w.count > 0 ? `${Math.max(8, (w.count / maxW) * 100)}%` : 4,
                              backgroundColor: isTop ? colors.primary : alpha(colors.primary, 0.45),
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.wdLabel,
                          isTop && { color: colors.primary, fontWeight: "800" },
                        ]}
                      >
                        {w.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassSurface>

            {/* Ish soatlari taqsimoti */}
            <GlassSurface style={styles.halfCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.cardMiniHeader}>
                <Clock size={15} color={colors.secondary} />
                <Text style={styles.miniCardTitle}>
                  {ru ? "Пиковые часы" : "Gavjum soatlar"}
                </Text>
              </View>

              {data.peakHourStr ? (
                <View style={[styles.highlightPill, { backgroundColor: alpha(colors.secondaryContainer, 0.25) }]}>
                  <Sparkles size={11} color={colors.secondary} />
                  <Text style={[styles.highlightPillText, { color: colors.secondary }]}>
                    {data.peakHourStr}
                  </Text>
                </View>
              ) : null}

              <View style={styles.weekdayChart}>
                {data.hourStats.slice(0, 7).map((h, i) => {
                  const maxH = Math.max(1, ...data.hourStats.map((x) => x.count));
                  return (
                    <View key={i} style={styles.wdCol}>
                      <View style={styles.wdBarTrack}>
                        <View
                          style={[
                            styles.wdBarFill,
                            {
                              height: h.count > 0 ? `${Math.max(8, (h.count / maxH) * 100)}%` : 4,
                              backgroundColor: colors.secondary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.wdLabel}>{h.hour}</Text>
                    </View>
                  );
                })}
              </View>
            </GlassSurface>
          </View>

          {/* 5. TOP XIZMATLAR REYTINGI */}
          {data.topServices.length > 0 && (
            <GlassSurface style={styles.sectionCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: alpha(colors.primaryContainer, 0.25) }]}>
                  <Award size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSectionTitle}>
                    {ru ? "Топ услуг по доходу" : "Eng daromadli xizmatlar"}
                  </Text>
                  <Text style={styles.cardSectionSub}>
                    {ru ? "Какие услуги приносят больше всего прибыли" : "Eng ko'p buyurtma qilingan xizmatlar"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 12, marginTop: 6 }}>
                {data.topServices.map((svc, idx) => {
                  const pct = data.revenue > 0 ? Math.round((svc.revenue / data.revenue) * 100) : 0;
                  return (
                    <View key={idx} style={styles.serviceRow}>
                      <View style={styles.svcRank}>
                        <Text style={styles.svcRankText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={styles.svcName} numberOfLines={1}>
                            {svc.name}
                          </Text>
                          <Text style={styles.svcRevenue}>
                            {formatSom(svc.revenue)} {ru ? "сум" : "so'm"}
                          </Text>
                        </View>
                        <View style={styles.svcProgressBar}>
                          <View
                            style={[
                              styles.svcProgressFill,
                              { width: `${Math.max(5, pct)}%`, backgroundColor: colors.primary },
                            ]}
                          />
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={styles.svcMeta}>
                            {svc.count} {ru ? "броней" : "ta bron"}
                          </Text>
                          <Text style={styles.svcPct}>{pct}% {ru ? "от выручки" : "tushumdan"}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </GlassSurface>
          )}

          {/* 6. XODIMLAR / USTALAR SAMARADORLIGI (agar mavjud bo'lsa) */}
          {data.staffStats.length > 0 && !isStaff && (
            <GlassSurface style={styles.sectionCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: alpha(colors.secondaryContainer, 0.25) }]}>
                  <Users size={16} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSectionTitle}>
                    {ru ? "Эффективность сотрудников" : "Xodimlar / ustalar samaradorligi"}
                  </Text>
                  <Text style={styles.cardSectionSub}>
                    {ru ? "Вклад каждого специалиста в бизнес" : "Har bir mutaxassisning tushumdagi ulushi"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 6 }}>
                {data.staffStats.map((st, idx) => {
                  const pct = data.revenue > 0 ? Math.round((st.revenue / data.revenue) * 100) : 0;
                  return (
                    <View key={idx} style={styles.staffRow}>
                      <View style={styles.staffAvatar}>
                        <Text style={styles.staffAvatarText}>
                          {st.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.staffName} numberOfLines={1}>
                          {st.name}
                        </Text>
                        <Text style={styles.staffSub}>
                          {st.count} {ru ? "выполненных заказов" : "ta bajarilgan bron"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.staffRevenue}>
                          {formatSom(st.revenue)} {ru ? "сум" : "so'm"}
                        </Text>
                        <Text style={styles.staffPct}>{pct}% {ru ? "доли" : "ulush"}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </GlassSurface>
          )}

          {/* 7. ENG SODIQ VA TOP MIJOZLAR (VIP CLIENTS) */}
          {data.topClients.length > 0 && (
            <GlassSurface style={styles.sectionCard} fallbackStyle={styles.kpiFallback}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: alpha(colors.tertiaryContainer, 0.25) }]}>
                  <Trophy size={16} color={colors.tertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSectionTitle}>
                    {ru ? "Топ постоянных клиентов" : "Top sodiq mijozlar"}
                  </Text>
                  <Text style={styles.cardSectionSub}>
                    {ru ? "Клиенты с наибольшей суммой заказов" : "Eng ko'p tashrif buyurgan mijozlar"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 6 }}>
                {data.topClients.map((client, idx) => (
                  <View key={client.id} style={styles.clientRow}>
                    <View style={styles.clientRank}>
                      <Text style={styles.clientRankText}>#{idx + 1}</Text>
                    </View>
                    <ClientAvatar name={client.name} avatarUrl={client.avatar} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.clientName} numberOfLines={1}>
                        {client.name}
                      </Text>
                      <Text style={styles.clientSub}>
                        {client.count} {ru ? "визитов" : "ta tashrif"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.clientSpend}>
                        {formatSom(client.spend)} {ru ? "сум" : "so'm"}
                      </Text>
                      <Text style={styles.clientAvg}>
                        ~{client.count > 0 ? formatSom(Math.round(client.spend / client.count)) : 0} {ru ? "ср. чек" : "o'rtacha"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </GlassSurface>
          )}

          {/* 8. BRONLAR TAQSIMOTI VA KONVERSIYA (STATUS BREAKDOWN) */}
          <GlassSurface style={styles.sectionCard} fallbackStyle={styles.kpiFallback}>
            <Text style={styles.cardSectionTitle}>
              {ru ? "Распределение броней" : "Bronlar taqsimoti"}
            </Text>
            <Text style={styles.cardSectionSub}>
              {ru ? "Соотношение успешных, предстоящих и отмененных заказов" : "Muvaffaqiyatli, rejalashtirilgan va bekor qilingan bronlar"}
            </Text>

            {/* Segmented bar */}
            <View style={styles.breakdownBar}>
              {data.completedCount > 0 && (
                <View
                  style={{
                    flex: data.completedCount,
                    backgroundColor: colors.primary,
                    height: "100%",
                  }}
                />
              )}
              {data.upcomingCount > 0 && (
                <View
                  style={{
                    flex: data.upcomingCount,
                    backgroundColor: colors.secondary,
                    height: "100%",
                  }}
                />
              )}
              {data.cancelledCount > 0 && (
                <View
                  style={{
                    flex: data.cancelledCount,
                    backgroundColor: colors.error,
                    height: "100%",
                  }}
                />
              )}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendLabel}>{ru ? "Завершено:" : "Yakunlandi:"}</Text>
                <Text style={styles.legendVal}>
                  {data.completedCount} ({data.completionRate}%)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                <Text style={styles.legendLabel}>{ru ? "Ожидается:" : "Kutilmoqda:"}</Text>
                <Text style={styles.legendVal}>{data.upcomingCount}</Text>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                <Text style={styles.legendLabel}>{ru ? "Отменено:" : "Bekor:"}</Text>
                <Text style={styles.legendVal}>
                  {data.cancelledCount} ({data.cancelRate}%)
                </Text>
              </View>
            </View>
          </GlassSurface>

          {/* 9. REKORD KUN BANNERI */}
          {data.recordAmount > 0 && data.recordDate && (
            <GlassSurface style={styles.recordBanner} fallbackStyle={styles.kpiFallback}>
              <View style={styles.recordIconWrap}>
                <Trophy size={20} color={colors.secondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.recordTitle}>
                  {ru ? "Абсолютный рекорд дохода за день" : "Kunlik rekord daromad"}
                </Text>
                <Text style={styles.recordDateText}>
                  {formatUzDate(data.recordDate)} · {formatSom(data.recordAmount)} {ru ? "сум" : "so'm"}
                </Text>
              </View>
            </GlassSurface>
          )}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    titleIcon: {
      padding: 10,
      borderRadius: radius.xl,
      backgroundColor: alpha(colors.primary, 0.12),
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 22, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
    subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

    periodRow: {
      flexDirection: "row",
      borderRadius: radius.xl,
      padding: 4,
      gap: 4,
      overflow: "hidden",
    },
    periodRowFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    periodBtn: {
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    periodText: { fontSize: 12, fontWeight: "700" },

    // Zumrad Hero Card
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: radius.xxxl,
      padding: 20,
      gap: 6,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: alpha(colors.onPrimary, 0.8),
      letterSpacing: 0.8,
    },
    growthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    growthText: { fontSize: 12, fontWeight: "800", color: "#ffffff" },
    heroAmountRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      marginTop: 4,
    },
    heroAmount: {
      fontSize: 38,
      fontWeight: "800",
      color: colors.onPrimary,
      letterSpacing: -1.2,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    heroSuffix: {
      fontSize: 16,
      fontWeight: "700",
      color: alpha(colors.onPrimary, 0.8),
    },
    heroDivider: {
      height: 1,
      backgroundColor: alpha(colors.onPrimary, 0.16),
      marginVertical: 10,
    },
    heroBottomRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    heroStatItem: { flex: 1 },
    heroStatSub: { fontSize: 11, fontWeight: "600", color: alpha(colors.onPrimary, 0.75) },
    heroStatVal: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.onPrimary,
      marginTop: 2,
    },
    heroStatSep: {
      width: 1,
      height: 28,
      backgroundColor: alpha(colors.onPrimary, 0.16),
      marginHorizontal: 12,
    },

    // KPI Grid
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    kpiCard: {
      flexBasis: "48%",
      flexGrow: 1,
      borderRadius: radius.xl,
      padding: 14,
      gap: 6,
      overflow: "hidden",
    },
    kpiFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    kpiTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    kpiIconWrap: {
      width: 30,
      height: 30,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      letterSpacing: 0.6,
      flex: 1,
    },
    kpiMainNumber: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    kpiSub: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant },

    // Dinamika grafigi
    chartCard: {
      borderRadius: radius.xl,
      padding: 16,
      gap: 14,
      overflow: "hidden",
    },
    chartHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    cardSectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
    cardSectionSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    chartModeRow: {
      flexDirection: "row",
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.4),
      borderRadius: radius.md,
      padding: 3,
      gap: 2,
    },
    chartModeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
    },
    chartModeBtnText: { fontSize: 11, fontWeight: "700" },

    selectedDayBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: alpha(colors.primaryContainer, 0.15),
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    selDayDate: { fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
    selDayMain: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
    clearDayBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: alpha(colors.onSurface, 0.08),
      borderRadius: radius.md,
    },
    clearDayText: { fontSize: 11, fontWeight: "700", color: colors.onSurface },

    barChartContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: 140,
      gap: 4,
      paddingTop: 8,
    },
    barCol: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      minWidth: 0,
      gap: 6,
    },
    barTrack: {
      flex: 1,
      width: "100%",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    barFill: {
      width: "100%",
      maxWidth: 16,
      borderRadius: 4,
    },
    barLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      textAlign: "center",
    },

    // Tanlangan kun akkordeoni
    selectedBookingsBlock: {
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      paddingTop: 12,
      gap: 8,
    },
    selHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    selSectionTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
    selCountBadge: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.primary,
      backgroundColor: alpha(colors.primaryContainer, 0.25),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    noApptsText: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: "center", paddingVertical: 12 },
    bookingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: alpha(colors.surfaceContainerLowest, 0.6),
      borderRadius: radius.md,
    },
    bkTimeCol: { flexDirection: "row", alignItems: "center", gap: 4, width: 56 },
    bkTimeText: { fontSize: 12, fontWeight: "700", color: colors.onSurface },
    bkClientName: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
    bkService: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
    bkPrice: { fontSize: 13, fontWeight: "700", color: colors.primary },
    bkStatus: { fontSize: 10, fontWeight: "700", marginTop: 1 },

    // 2 ustunli kichik grafiklar (Split Row)
    splitRow: { flexDirection: "row", gap: 10 },
    halfCard: {
      flex: 1,
      borderRadius: radius.xl,
      padding: 14,
      gap: 10,
      overflow: "hidden",
    },
    cardMiniHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    miniCardTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
    highlightPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      backgroundColor: alpha(colors.primaryContainer, 0.25),
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    highlightPillText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    weekdayChart: { flexDirection: "row", alignItems: "flex-end", height: 74, gap: 4 },
    wdCol: { flex: 1, alignItems: "center", height: "100%", gap: 4 },
    wdBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
    wdBarFill: { width: "100%", maxWidth: 10, borderRadius: 3 },
    wdLabel: { fontSize: 9, fontWeight: "700", color: colors.onSurfaceVariant },

    // Katta bo'lim kartasi (Section Card)
    sectionCard: {
      borderRadius: radius.xl,
      padding: 16,
      gap: 12,
      overflow: "hidden",
    },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    // Xizmatlar ro'yxati
    serviceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    svcRank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: alpha(colors.primary, 0.12),
      alignItems: "center",
      justifyContent: "center",
    },
    svcRankText: { fontSize: 12, fontWeight: "800", color: colors.primary },
    svcName: { fontSize: 14, fontWeight: "700", color: colors.onSurface, flex: 1 },
    svcRevenue: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
    svcProgressBar: {
      height: 5,
      backgroundColor: alpha(colors.outlineVariant, 0.4),
      borderRadius: 3,
      overflow: "hidden",
    },
    svcProgressFill: { height: "100%", borderRadius: 3 },
    svcMeta: { fontSize: 11, color: colors.onSurfaceVariant },
    svcPct: { fontSize: 11, fontWeight: "700", color: colors.primary },

    // Xodimlar ro'yxati
    staffRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 6,
    },
    staffAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: alpha(colors.secondaryContainer, 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    staffAvatarText: { fontSize: 14, fontWeight: "800", color: colors.secondary },
    staffName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
    staffSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
    staffRevenue: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
    staffPct: { fontSize: 11, fontWeight: "700", color: colors.secondary },

    // Mijozlar ro'yxati
    clientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    clientRank: { width: 22 },
    clientRankText: { fontSize: 12, fontWeight: "800", color: colors.onSurfaceVariant },
    clientName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
    clientSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
    clientSpend: { fontSize: 13, fontWeight: "800", color: colors.primary },
    clientAvg: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },

    // Bronlar taqsimoti (Breakdown)
    breakdownBar: {
      height: 10,
      borderRadius: 5,
      flexDirection: "row",
      overflow: "hidden",
      backgroundColor: alpha(colors.outlineVariant, 0.3),
      marginTop: 4,
    },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      marginTop: 6,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 12, color: colors.onSurfaceVariant },
    legendVal: { fontSize: 12, fontWeight: "700", color: colors.onSurface },

    // Rekord banner
    recordBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: alpha(colors.secondaryContainer, 0.15),
      borderWidth: 1,
      borderColor: alpha(colors.secondary, 0.25),
    },
    recordIconWrap: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: alpha(colors.secondaryContainer, 0.35),
      alignItems: "center",
      justifyContent: "center",
    },
    recordTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
    recordDateText: { fontSize: 12, fontWeight: "800", color: colors.secondary, marginTop: 2 },
  })
);
