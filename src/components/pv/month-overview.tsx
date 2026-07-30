// Oylik kalendar (heatmap) — Boshqaruvdagi 7 kunlik grafikni bosganda ochiladi.
// Har kun daromadiga qarab bo'yaladi; kun tanlansa o'sha kunning bronlari chiqadi.
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import type { Appointment } from "@/hooks/useAppointments";
import { formatSom } from "@/utils/price";
import { formatUzDate, UZ_MONTHS, UZ_WEEKDAYS, weekdayKeyOf } from "@/utils/tashkent";

const hhmm = (t: string) => (t || "").slice(0, 5);
const pad2 = (n: number) => String(n).padStart(2, "0");

const WD_HEADERS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

export function MonthOverviewModal({
  visible,
  onClose,
  appointments,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  appointments: Appointment[];
  today: string; // YYYY-MM-DD
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(today);

  // Ochilganda joriy oy + bugun tanlangan holatga qaytadi
  useEffect(() => {
    if (visible) {
      setYm(today.slice(0, 7));
      setSelected(today);
    }
  }, [visible, today]);

  const [year, month] = ym.split("-").map(Number);

  // Kun bo'yicha: daromad (yakunlangan) va bronlar soni (bekor qilinmagan)
  const byDay = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    appointments.forEach((a) => {
      if (!a.booking_date.startsWith(ym)) return;
      const cur = map.get(a.booking_date) || { revenue: 0, count: 0 };
      if (a.status === "completed") cur.revenue += a.price || 0;
      if (a.status !== "cancelled") cur.count += 1;
      map.set(a.booking_date, cur);
    });
    return map;
  }, [appointments, ym]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...[...byDay.values()].map((v) => v.revenue)),
    [byDay]
  );

  const monthTotals = useMemo(() => {
    let revenue = 0;
    let count = 0;
    byDay.forEach((v) => {
      revenue += v.revenue;
      count += v.count;
    });
    return { revenue, count };
  }, [byDay]);

  // Kalendar katakchalari — dushanbadan boshlanadigan hafta
  const cells = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstWd = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = yakshanba
    const offset = (firstWd + 6) % 7;
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(`${ym}-${pad2(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [ym, year, month]);

  const selBookings = useMemo(
    () =>
      selected
        ? appointments
            .filter((a) => a.booking_date === selected)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        : [],
    [appointments, selected]
  );
  const selInfo = selected ? byDay.get(selected) : undefined;

  const canGoNext = ym < today.slice(0, 7);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Sarlavha: oy navigatsiyasi + yopish */}
        <View style={styles.header}>
          <Pressable onPress={() => setYm((cur) => shiftYm(cur, -1))} style={styles.navBtn} hitSlop={8}>
            <ChevronLeft size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>
            {UZ_MONTHS[month - 1]} {year}
          </Text>
          <Pressable
            onPress={() => canGoNext && setYm((cur) => shiftYm(cur, 1))}
            style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]}
            hitSlop={8}
          >
            <ChevronRight size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <X size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Oy xulosasi */}
          <View style={styles.totalsRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={styles.totalSum} numberOfLines={1} adjustsFontSizeToFit>
                  {monthTotals.revenue > 0 ? formatSom(monthTotals.revenue) : "0"}
                </Text>
                <Text style={styles.totalSuffix}>{t("pv.som")}</Text>
              </View>
              <Text style={styles.totalSub}>{t("pv.n_bookings", { n: monthTotals.count })}</Text>
            </View>
          </View>

          {/* Hafta kunlari sarlavhasi */}
          <View style={styles.wdRow}>
            {WD_HEADERS.map((w) => (
              <Text key={w} style={styles.wdText}>
                {w}
              </Text>
            ))}
          </View>

          {/* Kalendar to'ri — daromadga qarab bo'yalgan */}
          <View style={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <View key={`e${i}`} style={styles.cell} />;
              const info = byDay.get(date);
              const heat = info && info.revenue > 0 ? 0.18 + 0.62 * (info.revenue / maxRevenue) : 0;
              const isSel = selected === date;
              const isToday = date === today;
              const isFuture = date > today;
              return (
                <Pressable
                  key={date}
                  style={[
                    styles.cell,
                    heat > 0 && { backgroundColor: alpha(colors.primary, heat) },
                    isSel && { backgroundColor: colors.primary },
                    isToday && !isSel && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelected((cur) => (cur === date ? null : date))}
                >
                  <Text
                    style={[
                      styles.cellDay,
                      isFuture && { color: colors.outline },
                      heat > 0.5 && { color: colors.onPrimary },
                      isSel && { color: colors.onPrimary, fontWeight: "800" },
                    ]}
                  >
                    {Number(date.slice(8, 10))}
                  </Text>
                  {info && info.count > 0 ? (
                    <Text
                      style={[
                        styles.cellCount,
                        (heat > 0.5 || isSel) && { color: alpha(colors.onPrimary, 0.85) },
                      ]}
                    >
                      {info.count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Tanlangan kun tafsilotlari */}
          {selected ? (
            <View style={styles.detail}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>
                  {UZ_WEEKDAYS[weekdayKeyOf(selected)]}, {formatUzDate(selected)}
                </Text>
                <Text style={styles.detailSum}>
                  {selInfo && selInfo.revenue > 0 ? `${formatSom(selInfo.revenue)} ${t("pv.som")}` : ""}
                </Text>
              </View>
              <Text style={styles.detailSub}>
                {t("pv.n_bookings", { n: selInfo?.count ?? 0 })}
              </Text>

              {selBookings.length === 0 ? (
                <Text style={styles.emptyText}>{t("pv.no_appts")}</Text>
              ) : (
                <View style={styles.list}>
                  {selBookings.map((a, i) => {
                    const cancelled = a.status === "cancelled";
                    return (
                      <View key={a.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                        <Text style={styles.rowTime}>{hhmm(a.start_time)}</Text>
                        <Text
                          style={[
                            styles.rowName,
                            cancelled && {
                              textDecorationLine: "line-through",
                              color: colors.onSurfaceVariant,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {a.client?.full_name || "—"}
                        </Text>
                        <Text style={[styles.rowPrice, cancelled && { color: colors.error }]}>
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
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    title: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.onSurface,
      textTransform: "capitalize",
      minWidth: 120,
      textAlign: "center",
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    scroll: { padding: 16, paddingBottom: 48, gap: 14 },

    totalsRow: { flexDirection: "row", alignItems: "center" },
    totalSum: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.8,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
    },
    totalSuffix: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceVariant },
    totalSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600", marginTop: 2 },

    wdRow: { flexDirection: "row" },
    wdText: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 0.95,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    cellDay: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
    },
    cellCount: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      fontVariant: ["tabular-nums"],
    },

    detail: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: 16,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
    },
    detailTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
    detailSum: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    detailSub: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600", marginTop: 2 },
    emptyText: {
      textAlign: "center",
      fontSize: 13,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
      paddingVertical: 20,
    },
    list: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
    rowTime: {
      width: 44,
      fontSize: 12,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      fontVariant: ["tabular-nums"],
    },
    rowName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.onSurface },
    rowPrice: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
  })
);
