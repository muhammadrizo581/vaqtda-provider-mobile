// Navbat (waitlist) — saytdagi app/dashboard/waitlist/page.tsx dan port.
import { BellRing, CheckCircle2, Hourglass, Phone, Zap } from "lucide-react-native";
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import {
  Card,
  ClientAvatar,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
} from "@/components/pv/ui";
import { alpha } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useWaitlistEntries, type WaitlistEntry } from "@/hooks/useWaitlistEntries";
import { localize } from "@/utils/localize";
import { formatUzDate } from "@/utils/tashkent";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

function WaitlistContent() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const { entries, loading, reload } = useWaitlistEntries();

  const stats = useMemo(() => {
    const waiting = entries.filter((e) => e.status === "waiting").length;
    const notified = entries.filter((e) => e.status === "notified").length;
    const converted = entries.filter((e) => e.status === "converted").length;
    return { waiting, notified, converted };
  }, [entries]);

  // Faollari tepada (waiting → notified → qolganlari), keyin sana bo'yicha
  const sorted = useMemo(() => {
    const rank = (s: string) => (s === "waiting" ? 0 : s === "notified" ? 1 : 2);
    return [...entries].sort(
      (a, b) => rank(a.status) - rank(b.status) || a.desired_date.localeCompare(b.desired_date)
    );
  }, [entries]);

  const statusMeta = (
    s: string
  ): { label: string; tone: "secondary" | "primary" | "tertiary" | "error" | "muted" } => {
    switch (s) {
      case "waiting":
        return { label: t("pv.wl_status_waiting"), tone: "tertiary" };
      case "notified":
        return { label: t("pv.wl_status_notified"), tone: "secondary" };
      case "converted":
        return { label: t("pv.wl_status_converted"), tone: "primary" };
      case "cancelled":
        return { label: t("pv.wl_status_cancelled"), tone: "error" };
      default:
        return { label: t("pv.wl_status_expired"), tone: "muted" };
    }
  };

  const dateInfo = (e: WaitlistEntry) => {
    const range =
      e.flexible && e.date_to && e.date_to !== e.desired_date
        ? `${formatUzDate(e.desired_date)} – ${formatUzDate(e.date_to)}`
        : formatUzDate(e.desired_date);
    const time = e.time_from && e.time_to ? ` · ${hhmm(e.time_from)}–${hhmm(e.time_to)}` : "";
    return range + time;
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title={t("pv.wl_title")} subtitle={t("pv.wl_sub")} />

      {/* Statistika */}
      <View style={styles.statsRow}>
        <StatCard
          label={t("pv.wl_stat_waiting")}
          value={stats.waiting}
          suffix={t("pv.stat_people")}
          icon={Hourglass}
          tone="tertiary"
        />
        <StatCard
          label={t("pv.wl_stat_notified")}
          value={stats.notified}
          suffix={t("pv.stat_people")}
          icon={BellRing}
          tone="secondary"
        />
        <StatCard
          label={t("pv.wl_stat_converted")}
          value={stats.converted}
          suffix={t("pv.stat_people")}
          icon={CheckCircle2}
          tone="primary"
        />
      </View>

      {/* Ro'yxat */}
      <Card>
        {loading ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <EmptyState icon={Hourglass} title={t("pv.wl_empty")} desc={t("pv.wl_empty_desc")} />
        ) : (
          sorted.map((e, i) => {
            const st = statusMeta(e.status);
            const note = localize(e.note);
            return (
              <View
                key={e.id}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.clientWrap}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <ClientAvatar
                      name={e.client?.full_name || null}
                      avatarUrl={e.client?.avatar_url}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {e.client?.full_name || "—"}
                      </Text>
                      {e.client?.phone ? (
                        <Pressable
                          onPress={() => Linking.openURL(`tel:${e.client!.phone}`)}
                          style={styles.phoneRow}
                        >
                          <Phone size={12} color={colors.secondary} />
                          <Text style={styles.phoneText}>{e.client.phone}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <StatusBadge label={st.label} tone={st.tone} />
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.dateText}>{dateInfo(e)}</Text>
                  {e.flexible && (
                    <View style={styles.flexBadge}>
                      <Zap size={12} color={colors.tertiary} />
                      <Text style={styles.flexText}>{t("pv.wl_flexible")}</Text>
                    </View>
                  )}
                  {e.duration_minutes ? (
                    <Text style={styles.duration}>
                      {e.duration_minutes} {t("common.min")}
                    </Text>
                  ) : null}
                </View>

                {note ? (
                  <Text style={styles.note} numberOfLines={2}>
                    “{note}”
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

export default function WaitlistScreen() {
  return (
    <BusinessGate>
      <WaitlistContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 8 },

  row: { padding: 16, gap: 10 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  clientWrap: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  rank: { fontSize: 16, fontWeight: "700", color: colors.onSurfaceVariant, width: 20 },
  name: { fontWeight: "600", fontSize: 14, color: colors.onSurface },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, alignSelf: "flex-start" },
  phoneText: { fontSize: 12, color: colors.secondary },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingLeft: 32 },
  dateText: { fontSize: 12, fontWeight: "600", color: colors.onSurface },
  flexBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: alpha(colors.tertiaryContainer, 0.2),
    borderWidth: 1,
    borderColor: alpha(colors.tertiaryContainer, 0.3),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  flexText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  duration: { fontSize: 12, color: colors.onSurfaceVariant },
  note: {
    fontSize: 12,
    color: alpha(colors.onSurfaceVariant, 0.8),
    fontStyle: "italic",
    paddingLeft: 32,
  },
}));
