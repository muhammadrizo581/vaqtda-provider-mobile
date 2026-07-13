// Bronlar — saytdagi app/dashboard/appointments/page.tsx dan port.
import { CalendarDays, CheckCircle2, Phone, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import {
  Card,
  ClientAvatar,
  EmptyState,
  FilterPill,
  GlassSurface,
  PageHeader,
  SmallButton,
  Spinner,
  StatusBadge,
} from "@/components/pv/ui";
import { alpha, colors } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useAppointments, type Appointment } from "@/hooks/useAppointments";
import { localize } from "@/utils/localize";
import { formatSom } from "@/utils/price";
import { createTashkentClock, formatUzDate, UZ_WEEKDAYS, weekdayKeyOf } from "@/utils/tashkent";

const tashkentClock = createTashkentClock();
const hhmm = (t: string) => (t || "").slice(0, 5);

// Kunlik bron: kelish–ketish orasidagi kunlar soni (kamida 1)
const dayCount = (from: string, to: string) => {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.max(1, Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000));
};

type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";

function AppointmentsContent() {
  const { t, lang } = useLanguage();
  const { appointments, loading, reload, act } = useAppointments();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const today = tashkentClock.now().dateStr;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (q) {
        const name = (a.client?.full_name || "").toLowerCase();
        const phone = (a.client?.phone || "").toLowerCase();
        const svc = (localize(a.services?.name, lang) || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !svc.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, statusFilter, query, lang]);

  // Sana bo'yicha guruhlash: kelgusilar (bugundan) o'sish tartibida,
  // o'tganlar kamayish tartibida — eng dolzarbi tepada.
  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filtered.forEach((a) => {
      const list = map.get(a.booking_date) || [];
      list.push(a);
      map.set(a.booking_date, list);
    });
    const dates = [...map.keys()];
    const future = dates.filter((d) => d >= today).sort();
    const past = dates.filter((d) => d < today).sort().reverse();
    return [...future, ...past].map((date) => ({
      date,
      items: (map.get(date) || []).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
  }, [filtered, today]);

  const statusLabel = (s: string) =>
    s === "upcoming"
      ? t("pv.status_upcoming")
      : s === "completed"
        ? t("pv.status_completed")
        : t("pv.status_cancelled");
  const statusTone = (s: string): "secondary" | "primary" | "error" =>
    s === "upcoming" ? "secondary" : s === "completed" ? "primary" : "error";
  const statusBar = (s: string) =>
    s === "upcoming" ? colors.primary : s === "completed" ? colors.secondary : alpha(colors.error, 0.6);

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("pv.filter_all") },
    { key: "upcoming", label: t("pv.status_upcoming") },
    { key: "completed", label: t("pv.status_completed") },
    { key: "cancelled", label: t("pv.status_cancelled") },
  ];

  const handleAct = (a: Appointment, action: "cancel" | "complete") => {
    const run = async () => {
      setActingId(a.id);
      await act(a.id, action);
      setActingId(null);
    };
    if (action === "cancel") {
      Alert.alert(t("pv.cancel_booking"), t("pv.confirm_cancel"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), style: "destructive", onPress: run },
      ]);
    } else {
      run();
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title={t("pv.appts_title")} subtitle={t("pv.appts_sub")} />

      {/* Qidiruv — iOS 26 da shisha yuzali qidiruv paneli */}
      <GlassSurface style={styles.searchWrap} fallbackStyle={styles.searchFallback}>
        <Search size={16} color={colors.onSurfaceVariant} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("pv.search_ph")}
          placeholderTextColor={colors.outline}
          style={styles.searchInput}
        />
      </GlassSurface>

      {/* Status filtri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={statusFilter === f.key}
            onPress={() => setStatusFilter(f.key)}
          />
        ))}
      </ScrollView>

      {/* Ro'yxat */}
      {loading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title={t("pv.no_appts")} desc={t("pv.no_appts_desc")} />
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.date}>
            {/* Sana sarlavhasi */}
            <View style={styles.groupHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Text style={styles.groupTitle}>
                  {UZ_WEEKDAYS[weekdayKeyOf(group.date)]}, {formatUzDate(group.date)}
                </Text>
                {group.date === today && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>{t("tt.today")}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.groupCount}>{group.items.length}</Text>
            </View>

            {group.items.map((a, i) => {
              const cancelled = a.status === "cancelled";
              return (
                <View
                  key={a.id}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
                  ]}
                >
                  {/* Chap holat chizig'i */}
                  <View style={[styles.statusBar, { backgroundColor: statusBar(a.status) }]} />
                  {/* Vaqt (kunlik bronda — necha kun) */}
                  <View style={styles.timeCol}>
                    {a.date_to && a.date_to !== a.booking_date ? (
                      <>
                        <Text
                          style={[
                            styles.timeStart,
                            cancelled && { textDecorationLine: "line-through", color: colors.onSurfaceVariant },
                          ]}
                        >
                          {dayCount(a.booking_date, a.date_to)}
                        </Text>
                        <Text style={styles.timeEnd}>{t("unit.day")}</Text>
                      </>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.timeStart,
                            cancelled && { textDecorationLine: "line-through", color: colors.onSurfaceVariant },
                          ]}
                        >
                          {hhmm(a.start_time)}
                        </Text>
                        <Text style={styles.timeEnd}>{hhmm(a.end_time)}</Text>
                      </>
                    )}
                  </View>
                  {/* Ma'lumot */}
                  <View style={styles.info}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <ClientAvatar
                        name={a.client?.full_name || null}
                        avatarUrl={a.client?.avatar_url}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.nameRow}>
                          <Text
                            style={[
                              styles.name,
                              cancelled && {
                                textDecorationLine: "line-through",
                                color: colors.onSurfaceVariant,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {a.client?.full_name || "—"}
                          </Text>
                          <StatusBadge label={statusLabel(a.status)} tone={statusTone(a.status)} />
                        </View>
                        <Text style={styles.service} numberOfLines={1}>
                          {localize(a.services?.name, lang) || "—"}
                          {a.table_name ? ` · ${a.table_name}` : ""}
                          {a.date_to && a.date_to !== a.booking_date
                            ? ` · ${formatUzDate(a.booking_date)} → ${formatUzDate(a.date_to)}`
                            : a.duration_minutes
                              ? ` · ${a.duration_minutes} ${t("common.min")}`
                              : ""}
                          {a.price != null ? ` · ${formatSom(a.price)}` : ""}
                        </Text>
                        {a.client?.phone ? (
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${a.client!.phone}`)}
                            style={styles.phoneRow}
                          >
                            <Phone size={12} color={colors.secondary} />
                            <Text style={styles.phoneText}>{a.client.phone}</Text>
                          </Pressable>
                        ) : null}
                        {a.notes ? (
                          <Text style={styles.notes} numberOfLines={2}>
                            “{a.notes}”
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {/* Amallar */}
                    {a.status === "upcoming" &&
                      (actingId === a.id ? (
                        <View style={{ alignItems: "center", paddingVertical: 4 }}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      ) : (
                        <View style={styles.actions}>
                          <SmallButton
                            label={t("pv.cancel_booking")}
                            icon={X}
                            variant="outline"
                            onPress={() => handleAct(a, "cancel")}
                            style={{ flex: 1 }}
                          />
                          <SmallButton
                            label={t("pv.complete")}
                            icon={CheckCircle2}
                            onPress={() => handleAct(a, "complete")}
                            style={{ flex: 1 }}
                          />
                        </View>
                      ))}
                  </View>
                </View>
              );
            })}
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function AppointmentsScreen() {
  return (
    <BusinessGate>
      <AppointmentsContent />
    </BusinessGate>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  searchFallback: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.onSurface },

  groupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupCount: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "500" },

  row: { flexDirection: "row", alignItems: "stretch" },
  statusBar: { width: 4 },
  timeCol: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
  },
  timeStart: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  timeEnd: { fontSize: 11, color: colors.onSurfaceVariant },

  info: { flex: 1, minWidth: 0, padding: 12, gap: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontWeight: "600", fontSize: 14, color: colors.onSurface, flexShrink: 1 },
  service: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, alignSelf: "flex-start" },
  phoneText: { fontSize: 12, color: colors.secondary },
  notes: { fontSize: 12, color: alpha(colors.onSurfaceVariant, 0.8), marginTop: 4, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8 },
});
