// Tarif (PLUS/PRO) — joriy holat + qo'lda sotib olish so'rovi.
// Hozircha karta/avtopullov yo'q: "Sotib olish" bosilsa so'rov yuboriladi,
// admin qo'lda tekshirib (to'lov tushgach) tarifni yoqadi.
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Clock, Crown, History, Hourglass, Zap } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { Card, GlassIconButton, SmallButton, Spinner, StatusBadge } from "@/components/pv/ui";
import { alpha, radius, type BadgeTone } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { usePlanRequest, type PlanRequest } from "@/hooks/usePlanRequest";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

// ISO timestamp -> "12.08.2026, 15:30"
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}, ${hh}:${min}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

interface PlanDef {
  code: "plus" | "pro";
  price: string;
  icon: typeof Zap;
  features: string[];
}

export default function PlanScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { provider, loading: providerLoading, reload: reloadProvider } = useProvider();
  const {
    pending,
    history,
    loading: reqLoading,
    sending,
    requestPlan,
    reload: reloadPlan,
  } = usePlanRequest();

  const isTrial = provider?.subscription_status === "trial";
  const currentPlan = provider?.plan_code || "pro";
  const trialDays = daysLeft(provider?.trial_ends_at);
  const expiresDays = daysLeft(provider?.plan_expires_at);

  const historyMeta = (
    s: PlanRequest["status"]
  ): { label: string; tone: BadgeTone } => {
    switch (s) {
      case "approved":
        return { label: t("plan.hist_approved"), tone: "primary" };
      case "rejected":
        return { label: t("plan.hist_rejected"), tone: "error" };
      default:
        return { label: t("plan.hist_pending"), tone: "tertiary" };
    }
  };

  const plans: PlanDef[] = useMemo(
    () => [
      {
        code: "plus",
        price: t("plan.plus_price"),
        icon: Zap,
        features: [t("plan.f_staff_limited"), t("plan.f_no_waitlist"), t("plan.f_history_1m"), t("plan.f_no_top")],
      },
      {
        code: "pro",
        price: t("plan.pro_price"),
        icon: Crown,
        features: [t("plan.f_staff_unlimited"), t("plan.f_waitlist"), t("plan.f_history_full"), t("plan.f_top")],
      },
    ],
    [t]
  );

  const loading = providerLoading || reqLoading;

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => {
        reloadProvider();
        reloadPlan();
      }}
    >
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("plan.title")}</Text>
          <Text style={styles.subtitle}>{t("plan.sub")}</Text>
        </View>
      </View>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Joriy holat */}
          <Card style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View style={styles.statusLeft}>
                {currentPlan === "pro" ? (
                  <Crown size={20} color={colors.primary} />
                ) : (
                  <Zap size={20} color={colors.primary} />
                )}
                <Text style={styles.statusTitle}>
                  {isTrial ? t("plan.status_trial") : currentPlan === "pro" ? t("plan.status_pro") : t("plan.status_plus")}
                </Text>
              </View>
              <StatusBadge
                label={isTrial ? t("plan.badge_trial") : t("plan.badge_active")}
                tone={isTrial ? "tertiary" : "primary"}
              />
            </View>
            <Text style={styles.statusDesc}>
              {isTrial
                ? t("plan.trial_desc_detailed", { date: fmtDate(provider?.trial_ends_at), days: trialDays })
                : provider?.plan_expires_at
                  ? t("plan.expires_desc_detailed", {
                      start: fmtDate(provider?.plan_started_at),
                      end: fmtDate(provider?.plan_expires_at),
                      days: expiresDays,
                    })
                  : t("plan.no_expiry_desc")}
            </Text>
          </Card>

          {/* Kutilayotgan so'rov bo'lsa — shu yerda ko'rsatamiz */}
          {pending ? (
            <Card style={styles.pendingCard}>
              <Hourglass size={16} color={colors.tertiary} />
              <Text style={styles.pendingText}>
                {t("plan.pending_desc", { plan: pending.requested_plan.toUpperCase() })}
              </Text>
            </Card>
          ) : null}

          {/* Tariflar */}
          <View style={{ gap: 12 }}>
            {plans.map((p) => {
              const isCurrent = !isTrial && currentPlan === p.code;
              const isPendingThis = pending?.requested_plan === p.code;
              return (
                <Card key={p.code} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={styles.planHeaderLeft}>
                      <p.icon size={18} color={colors.primary} />
                      <Text style={styles.planName}>{t(`plan.name_${p.code}`)}</Text>
                    </View>
                    <Text style={styles.planPrice}>{p.price}</Text>
                  </View>
                  <View style={styles.featureList}>
                    {p.features.map((f, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Check size={13} color={colors.secondary} />
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  {isCurrent ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>{t("plan.current")}</Text>
                    </View>
                  ) : (
                    <SmallButton
                      label={isPendingThis ? t("plan.requested") : t("plan.buy")}
                      onPress={() => requestPlan(p.code)}
                      loading={sending}
                      disabled={!!pending}
                    />
                  )}
                </Card>
              );
            })}
          </View>

          <View style={styles.hintRow}>
            <Clock size={13} color={colors.onSurfaceVariant} />
            <Text style={styles.hintText}>{t("plan.manual_hint")}</Text>
          </View>

          {/* So'rovlar tarixi — qachon so'ralgan, qachon ko'rib chiqilgan */}
          {history.length > 0 ? (
            <View style={{ gap: 8 }}>
              <View style={styles.historyHeader}>
                <History size={14} color={colors.onSurfaceVariant} />
                <Text style={styles.historyTitle}>{t("plan.history_title")}</Text>
              </View>
              <Card>
                {history.map((h, i) => {
                  const meta = historyMeta(h.status);
                  return (
                    <View
                      key={h.id}
                      style={[
                        styles.historyRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.historyPlan}>{h.requested_plan.toUpperCase()}</Text>
                        <Text style={styles.historyDate}>
                          {t("plan.hist_requested_at", { date: fmtDateTime(h.created_at) })}
                          {h.reviewed_at ? ` · ${t("plan.hist_reviewed_at", { date: fmtDateTime(h.reviewed_at) })}` : ""}
                        </Text>
                      </View>
                      <StatusBadge label={meta.label} tone={meta.tone} />
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
    subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

    statusCard: { padding: 16, gap: 8 },
    statusTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
    statusDesc: { fontSize: 12, color: colors.onSurfaceVariant },

    pendingCard: {
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: alpha(colors.tertiaryContainer, 0.15),
    },
    pendingText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant, flex: 1 },

    planCard: { padding: 16, gap: 12 },
    planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    planHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    planName: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
    planPrice: { fontSize: 14, fontWeight: "700", color: colors.primary },

    featureList: { gap: 6 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { fontSize: 12, color: colors.onSurfaceVariant, flex: 1 },

    currentPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.md,
      backgroundColor: alpha(colors.primaryContainer, 0.2),
    },
    currentPillText: { fontSize: 12, fontWeight: "700", color: colors.primary },

    hintRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
    hintText: { fontSize: 11, color: colors.onSurfaceVariant, flex: 1 },

    historyHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
    historyTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceVariant },
    historyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
    historyPlan: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
    historyDate: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  })
);
