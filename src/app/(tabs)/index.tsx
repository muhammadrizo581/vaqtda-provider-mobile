// Boshqaruv (Overview) — "Grafit Zumrad" qayta dizayni.
// Tartib: salomlashuv → zumrad hero (bugungi daromad) → ikkita ixcham stat chip →
// "Keyingi bron" spotlight → qolgan bronlar vaqt izi (timeline) bo'ylab.
import { useRouter } from "expo-router";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Hourglass,
  Settings,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedLogo } from "@/components/animated-logo";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import {
  ClientAvatar,
  EmptyState,
  GlassIconButton,
  SmallButton,
  Spinner,
  StatusBadge,
} from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
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
  const colors = useColors();
  const styles = useStyles();
  const { t, lang } = useLanguage();
  const { appointments, loading, reload, act } = useAppointments();
  const { entries: waitlist, reload: reloadWaitlist } = useWaitlistEntries();
  const [actingId, setActingId] = useState<string | null>(null);
  const router = useRouter();

  const now = tashkentClock.now();
  const today = now.dateStr;

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

  // Spotlight: hali tugamagan eng yaqin bron; hammasi o'tib ketgan bo'lsa — birinchi kutilayotgani
  const next = useMemo(
    () =>
      todays.find((a) => a.status === "upcoming" && hhmm(a.end_time) >= now.hhmm) ??
      todays.find((a) => a.status === "upcoming"),
    [todays, now.hhmm]
  );
  const timeline = useMemo(() => todays.filter((a) => a.id !== next?.id), [todays, next]);

  const hour = Number(now.hhmm.slice(0, 2));
  const greeting =
    hour < 12 ? t("pv.greet_morning") : hour < 18 ? t("pv.greet_day") : t("pv.greet_evening");

  const statusLabel = (s: string) =>
    s === "upcoming"
      ? t("pv.status_upcoming")
      : s === "completed"
        ? t("pv.status_completed")
        : t("pv.status_cancelled");

  const serviceLine = (a: Appointment) => {
    const parts = [localize(a.services?.name, lang) || "—"];
    if (a.duration_minutes) parts.push(`${a.duration_minutes} ${t("common.min")}`);
    if (a.price) parts.push(`${formatSom(a.price)} ${t("pv.som")}`);
    return parts.join(" · ");
  };

  const dotColor = (s: string) =>
    s === "upcoming"
      ? colors.secondary
      : s === "completed"
        ? colors.primary
        : s === "cancelled"
          ? colors.error
          : colors.outline;

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

  const renderActions = (a: Appointment) =>
    actingId === a.id ? (
      <View style={{ alignItems: "center", paddingVertical: 4 }}>
        <AnimatedLogo variant="loading" size={20} background={null} foreground={colors.primary} />
      </View>
    ) : (
      <View style={styles.actionsRow}>
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
    );

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => {
        reload();
        reloadWaitlist();
      }}
    >
      {/* Salomlashuv + tezkor tugmalar */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title}>{t("pv.nav_dashboard")}</Text>
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
        <View style={styles.chip}>
          <View style={styles.chipIcon}>
            <CalendarClock size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chipValue}>{stats.upcoming}</Text>
            <Text style={styles.chipLabel} numberOfLines={1}>
              {t("pv.stat_upcoming")}
            </Text>
          </View>
        </View>
        <View style={styles.chip}>
          <View style={[styles.chipIcon, { backgroundColor: alpha(colors.secondaryContainer, 0.18) }]}>
            <Hourglass size={16} color={colors.secondary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chipValue}>{stats.activeWaitlist}</Text>
            <Text style={styles.chipLabel} numberOfLines={1}>
              {t("pv.stat_waitlist")}
            </Text>
          </View>
        </View>
      </View>

      {/* Keyingi bron — spotlight */}
      {next ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>{t("pv.next_booking")}</Text>
          <View style={styles.nextRow}>
            <View>
              <Text style={styles.nextTime}>{hhmm(next.start_time)}</Text>
              <Text style={styles.nextTimeEnd}>{hhmm(next.end_time)}</Text>
            </View>
            <View style={styles.nextDivider} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.apptName} numberOfLines={1}>
                {next.client?.full_name || "—"}
              </Text>
              <Text style={styles.apptService} numberOfLines={2}>
                {serviceLine(next)}
              </Text>
            </View>
            <ClientAvatar
              name={next.client?.full_name || null}
              avatarUrl={next.client?.avatar_url}
              size={40}
            />
          </View>
          {renderActions(next)}
        </View>
      ) : null}

      {/* Bugungi jadval — vaqt izi bo'ylab */}
      <View>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t("pv.today_schedule")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/appointments")}>
            <Text style={styles.viewAll}>{t("pv.view_all")} →</Text>
          </Pressable>
        </View>

        {loading ? (
          <Spinner />
        ) : todays.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("pv.empty_today")} />
        ) : (
          timeline.map((a, i) => (
            <View key={a.id} style={styles.tlRow}>
              <Text
                style={[styles.tlTime, a.status !== "upcoming" && { color: colors.onSurfaceVariant }]}
              >
                {hhmm(a.start_time)}
              </Text>
              <View style={styles.tlRail}>
                <View style={[styles.tlDot, { backgroundColor: dotColor(a.status) }]} />
                {i < timeline.length - 1 ? <View style={styles.tlLine} /> : null}
              </View>
              <View style={[styles.tlCard, a.status === "cancelled" && { opacity: 0.55 }]}>
                <View style={styles.tlCardTop}>
                  <ClientAvatar name={a.client?.full_name || null} avatarUrl={a.client?.avatar_url} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.apptName} numberOfLines={1}>
                      {a.client?.full_name || "—"}
                    </Text>
                    <Text style={styles.apptService} numberOfLines={1}>
                      {serviceLine(a)}
                    </Text>
                  </View>
                  <StatusBadge label={statusLabel(a.status)} tone={statusTone(a.status)} />
                </View>
                {a.status === "upcoming" ? renderActions(a) : null}
              </View>
            </View>
          ))
        )}
      </View>
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
    greeting: { fontSize: 13, fontWeight: "500", color: colors.onSurfaceVariant, marginBottom: 2 },
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
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: 12,
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

    nextCard: {
      backgroundColor: alpha(colors.primaryContainer, 0.08),
      borderWidth: 1,
      borderColor: alpha(colors.primaryContainer, 0.3),
      borderRadius: radius.xl,
      padding: 16,
      gap: 12,
    },
    nextLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    nextRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    nextTime: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.primary,
      letterSpacing: -0.5,
      fontVariant: ["tabular-nums"],
    },
    nextTimeEnd: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      fontVariant: ["tabular-nums"],
      marginTop: 1,
    },
    nextDivider: { width: 1, alignSelf: "stretch", backgroundColor: alpha(colors.primaryContainer, 0.3) },

    apptName: { fontWeight: "600", fontSize: 14, color: colors.onSurface },
    apptService: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 },
    actionsRow: { flexDirection: "row", gap: 8 },

    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.3 },
    viewAll: { color: colors.primary, fontSize: 13, fontWeight: "600" },

    tlRow: { flexDirection: "row", gap: 10 },
    tlTime: {
      width: 42,
      fontSize: 13,
      fontWeight: "700",
      color: colors.onSurface,
      paddingTop: 12,
      fontVariant: ["tabular-nums"],
    },
    tlRail: { width: 12, alignItems: "center", paddingTop: 17 },
    tlDot: { width: 8, height: 8, borderRadius: 4 },
    tlLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: colors.outlineVariant, marginTop: 4 },
    tlCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: 12,
      gap: 10,
      marginBottom: 10,
    },
    tlCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  })
);
