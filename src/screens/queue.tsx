// Shifokorning jonli navbati — bo'lim (departament) bo'yicha kutayotgan bemorlar.
import { BellRing, Check, Hourglass, Phone, Stethoscope, X } from "lucide-react-native";
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import {
  Card,
  ClientAvatar,
  EmptyState,
  PageHeader,
  SmallButton,
  Spinner,
  StatCard,
  StatusBadge,
  TogglePill,
} from "@/components/pv/ui";
import { useDepartmentQueue, type QueueEntry } from "@/hooks/useDepartmentQueue";
import { alpha } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const elapsedMin = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

function QueueContent() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const {
    entries,
    loading,
    departmentId,
    departmentName,
    isAvailable,
    toggleAvailability,
    setEntryStatus,
    reload,
  } = useDepartmentQueue();

  const stats = useMemo(() => {
    const waiting = entries.filter((e) => e.status === "waiting").length;
    const notified = entries.filter((e) => e.status === "notified").length;
    return { waiting, notified };
  }, [entries]);

  const statusMeta = (
    s: string
  ): { label: string; tone: "secondary" | "primary" | "tertiary" | "error" | "muted" } => {
    switch (s) {
      case "waiting":
        return { label: t("pv.queue_status_waiting"), tone: "tertiary" };
      case "notified":
        return { label: t("pv.queue_status_notified"), tone: "secondary" };
      default:
        return { label: t("pv.queue_status_waiting"), tone: "muted" };
    }
  };

  return (
    <Screen onRefresh={reload}>
      <PageHeader title={t("pv.queue_title")} subtitle={departmentName || undefined} />

      {/* Bo'sh / band tumbler */}
      <Card style={styles.availCard}>
        <View style={styles.availRow}>
          <View style={styles.availLeft}>
            <Stethoscope size={18} color={isAvailable ? colors.primary : colors.onSurfaceVariant} />
            <Text style={styles.availLabel}>
              {isAvailable ? t("pv.queue_status_available") : t("pv.queue_status_busy")}
            </Text>
          </View>
          <TogglePill value={isAvailable} onToggle={toggleAvailability} />
        </View>
        <Text style={styles.availHint}>{t("pv.queue_toggle_hint")}</Text>
      </Card>

      {!departmentId ? (
        <Card>
          <EmptyState icon={Stethoscope} title={t("pv.queue_empty")} desc={t("pv.queue_sub_no_dept")} />
        </Card>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label={t("pv.queue_stat_waiting")}
              value={stats.waiting}
              suffix={t("pv.stat_people")}
              icon={Hourglass}
              tone="tertiary"
            />
            <StatCard
              label={t("pv.queue_stat_notified")}
              value={stats.notified}
              suffix={t("pv.stat_people")}
              icon={BellRing}
              tone="secondary"
            />
          </View>

          <Card>
            {loading && entries.length === 0 ? (
              <Spinner />
            ) : entries.length === 0 ? (
              <EmptyState icon={Hourglass} title={t("pv.queue_empty")} desc={t("pv.queue_empty_desc")} />
            ) : (
              entries.map((e: QueueEntry, i: number) => {
                const st = statusMeta(e.status);
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
                        <ClientAvatar name={e.client?.full_name || null} avatarUrl={e.client?.avatar_url} />
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

                    <Text style={styles.metaText}>
                      {elapsedMin(e.created_at)} {t("common.min")}
                    </Text>

                    {e.note ? (
                      <Text style={styles.note} numberOfLines={2}>
                        “{e.note}”
                      </Text>
                    ) : null}

                    <View style={styles.actions}>
                      <SmallButton
                        label={t("pv.queue_action_done")}
                        icon={Check}
                        onPress={() => setEntryStatus(e.id, "converted")}
                      />
                      <SmallButton
                        label={t("pv.queue_action_cancel")}
                        icon={X}
                        variant="outline"
                        onPress={() => setEntryStatus(e.id, "cancelled")}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

export default function QueueScreen() {
  return (
    <BusinessGate>
      <QueueContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    availCard: { padding: 16, gap: 8 },
    availRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    availLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    availLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
    availHint: { fontSize: 12, color: colors.onSurfaceVariant },

    statsRow: { flexDirection: "row", gap: 8 },

    row: { padding: 16, gap: 10 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    clientWrap: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
    rank: { fontSize: 16, fontWeight: "700", color: colors.onSurfaceVariant, width: 20 },
    name: { fontWeight: "600", fontSize: 14, color: colors.onSurface },
    phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, alignSelf: "flex-start" },
    phoneText: { fontSize: 12, color: colors.secondary },

    metaText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant, paddingLeft: 32 },
    note: {
      fontSize: 12,
      color: alpha(colors.onSurfaceVariant, 0.8),
      fontStyle: "italic",
      paddingLeft: 32,
    },
    actions: { flexDirection: "row", gap: 8, paddingLeft: 32 },
  })
);
