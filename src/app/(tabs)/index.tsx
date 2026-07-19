// Boshqaruv (Overview) — saytdagi app/dashboard/page.tsx dan port (mobil karta ko'rinishi).
import { useRouter } from "expo-router";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock4,
  Hourglass,
  Settings,
  Wallet,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedLogo } from "@/components/animated-logo";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import {
  Card,
  ClientAvatar,
  EmptyState,
  GlassIconButton,
  liquidGlass,
  SmallButton,
  Spinner,
  StatCard,
  StatusBadge,
} from "@/components/pv/ui";
import { alpha, colors } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useAppointments, type Appointment } from "@/hooks/useAppointments";
import { useWaitlistEntries } from "@/hooks/useWaitlistEntries";
import { localize } from "@/utils/localize";
import { formatSom } from "@/utils/price";
import { createTashkentClock } from "@/utils/tashkent";

const tashkentClock = createTashkentClock();

const hhmm = (t: string) => (t || "").slice(0, 5);

// Bron holati → badge toni
function statusTone(status: string): "secondary" | "primary" | "muted" | "error" {
  if (status === "upcoming") return "secondary";
  if (status === "completed") return "primary";
  if (status === "cancelled") return "error";
  return "muted";
}

function OverviewContent() {
  const { t, lang } = useLanguage();
  const { appointments, loading, reload, act } = useAppointments();
  const { entries: waitlist, reload: reloadWaitlist } = useWaitlistEntries();
  const [actingId, setActingId] = useState<string | null>(null);
  const router = useRouter();

  const today = tashkentClock.now().dateStr;

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

  const statusLabel = (s: string) =>
    s === "upcoming"
      ? t("pv.status_upcoming")
      : s === "completed"
        ? t("pv.status_completed")
        : t("pv.status_cancelled");

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
    <Screen
      refreshing={loading}
      onRefresh={() => {
        reload();
        reloadWaitlist();
      }}
    >
      {/* Sarlavha + statistika/sozlamalar tugmalari */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("pv.nav_dashboard")}</Text>
          <Text style={styles.subtitle}>{t("pv.overview_sub")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <GlassIconButton onPress={() => router.push("/stats")}>
            <BarChart3 size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <GlassIconButton onPress={() => router.push("/settings")}>
            <Settings size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
        </View>
      </View>

      {/* Statistika */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard
            label={t("pv.stat_today")}
            value={stats.todayCount}
            icon={CalendarDays}
            tone="secondary"
          />
          <StatCard
            label={t("pv.stat_waitlist")}
            value={stats.activeWaitlist}
            suffix={t("pv.stat_people")}
            icon={Hourglass}
            tone="tertiary"
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label={t("pv.stat_earnings")}
            value={stats.earnings > 0 ? formatSom(stats.earnings) : "—"}
            icon={Wallet}
            tone="primary"
          />
          <StatCard
            label={t("pv.stat_upcoming")}
            value={stats.upcoming}
            icon={CalendarClock}
            tone="secondary"
          />
        </View>
      </View>

      {/* Bugungi jadval */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("pv.today_schedule")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/appointments")}>
            <Text style={styles.viewAll}>{t("pv.view_all")} →</Text>
          </Pressable>
        </View>

        {loading ? (
          <Spinner />
        ) : todays.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("pv.empty_today")} />
        ) : (
          todays.map((a, i) => (
            <View
              key={a.id}
              style={[styles.apptRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant }]}
            >
              <View style={styles.apptTop}>
                <View style={styles.apptClient}>
                  <ClientAvatar name={a.client?.full_name || null} avatarUrl={a.client?.avatar_url} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.apptName} numberOfLines={1}>
                      {a.client?.full_name || "—"}
                    </Text>
                    <Text style={styles.apptService} numberOfLines={1}>
                      {localize(a.services?.name, lang) || "—"}
                      {a.duration_minutes ? ` · ${a.duration_minutes} ${t("common.min")}` : ""}
                    </Text>
                  </View>
                </View>
                <StatusBadge label={statusLabel(a.status)} tone={statusTone(a.status)} />
              </View>
              <View style={styles.apptTime}>
                <Clock4 size={14} color={colors.onSurfaceVariant} />
                <Text style={styles.apptTimeText}>
                  {hhmm(a.start_time)} – {hhmm(a.end_time)}
                </Text>
              </View>
              {a.status === "upcoming" &&
                (actingId === a.id ? (
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <AnimatedLogo variant="loading" size={20} background={null} foreground={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.apptActions}>
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
          ))
        )}
      </Card>
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

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 2 },
  statsGrid: { gap: 12 },
  statsRow: { flexDirection: "row", gap: 12 },

  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    // Glass rejimida sarlavha ham shishadan ko'rinib turadi
    borderBottomColor: liquidGlass ? alpha(colors.outlineVariant, 0.5) : colors.outlineVariant,
    backgroundColor: liquidGlass ? alpha(colors.surfaceContainerLow, 0.35) : colors.surfaceContainerLow,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  viewAll: { color: colors.primary, fontSize: 13, fontWeight: "500" },

  apptRow: { padding: 16, gap: 12 },
  apptTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  apptClient: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  apptName: { fontWeight: "600", fontSize: 14, color: colors.onSurface },
  apptService: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 },
  apptTime: { flexDirection: "row", alignItems: "center", gap: 8 },
  apptTimeText: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  apptActions: { flexDirection: "row", gap: 8 },
});
