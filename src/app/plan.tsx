// Tarif (PLUS/PRO) — joriy holat, oylik/yillik tanlov va Click/Payme orqali sotib olish.
// Oqim (web panel va mijoz ilovasi bilan bir xil to'lov infratuzilmasi):
//   1) "Sotib olish" → to'lov usuli oynasi (Click / Payme)
//   2) subscription-checkout Edge Function buyurtma yaratadi (narx serverda)
//   3) Click/Payme to'lov sahifasi ochiladi; to'lovni webhook tasdiqlaydi
//   4) Bazadagi trigger tarifni faollashtiradi — ekran holatni kuzatib, yangilanadi
import { useRouter } from "expo-router";
import { ArrowLeft, Check, ChevronRight, Crown, Lock, ShieldCheck, X, Zap } from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import { Card, GlassIconButton, SmallButton, Spinner } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useSubscriptionCheckout, type PayMethod } from "@/hooks/useSubscriptionCheckout";
import type { TKey } from "@/locales/uz";
import { CLICK_ENABLED } from "@/utils/click";
import { PAYME_ENABLED } from "@/utils/payme";
import { getSubscription, PLAN_PRICES, TRIAL_DAYS, type BillingCycle, type PlanCode } from "@/utils/plan";
import { formatSom } from "@/utils/price";

// To'lov usullari — logotip plitkalari rasmiy brend ranglarida
const METHODS: { id: PayMethod; label: string; color: string; enabled: boolean }[] = [
  { id: "click", label: "Click", color: "#00A5CF", enabled: CLICK_ENABLED },
  { id: "payme", label: "Payme", color: "#00CCCC", enabled: PAYME_ENABLED },
];

// App Store qoidasi (Guideline 3.1.1): ilova imkoniyatlarini ochadigan obuna iOS'da faqat
// Apple In-App Purchase orqali sotilishi mumkin. Shu sabab iOS'da narx, davr tanlovi va
// sotib olish tugmalari ko'rsatilmaydi — faqat joriy holat, imkoniyatlar va tarix.
// Click/Payme orqali sotib olish Android (va web panel) da ishlaydi.
const PURCHASE_ENABLED = Platform.OS !== "ios";

const PLAN_FEATURES: Record<PlanCode, { key: TKey; on: boolean }[]> = {
  plus: [
    { key: "plan.f_staff_limited", on: true },
    { key: "plan.f_history_1m", on: true },
    { key: "plan.f_no_waitlist", on: false },
    { key: "plan.f_no_top", on: false },
  ],
  pro: [
    { key: "plan.f_staff_unlimited", on: true },
    { key: "plan.f_waitlist", on: true },
    { key: "plan.f_history_full", on: true },
    { key: "plan.f_top", on: true },
  ],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// ISO -> "12.08.2026"
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ISO -> "12.08.2026, 15:30"
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${fmtDate(iso)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const methodLabel = (m: string) => (m === "click" ? "Click" : m === "payme" ? "Payme" : m);

export default function PlanScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { provider, loading: providerLoading, reload: reloadProvider } = useProvider();
  const checkout = useSubscriptionCheckout({
    onPaid: (plan) => showToast(t("plan.paid_ok", { plan: plan.toUpperCase() })),
  });

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [sheetPlan, setSheetPlan] = useState<PlanCode | null>(null);

  const sub = getSubscription(provider);
  // Progress chizig'i uchun davr uzunligi: sinov 60 kun, obuna — oxirgi to'lov davri
  const lastPeriod = checkout.history.find((h) => h.status === "completed")?.period_months ?? 1;
  const totalDays = sub.isTrial ? TRIAL_DAYS : lastPeriod >= 12 ? 365 : 30;
  const progress = sub.isExpired || !sub.endsAt ? 0 : Math.min(1, sub.daysLeft / totalDays);
  const statusColor = sub.isExpired ? colors.error : sub.isTrial ? colors.tertiary : colors.primary;
  const statusTitle = sub.isTrial
    ? t("plan.status_trial")
    : sub.isExpired
      ? t("plan.status_expired")
      : sub.plan === "pro"
        ? t("plan.status_pro")
        : t("plan.status_plus");
  const statusBadge = sub.isTrial ? t("plan.badge_trial") : sub.isExpired ? t("plan.badge_expired") : t("plan.badge_active");

  // Har bir tarif tugmasining holati
  const planAction = (code: PlanCode): { label: string; disabled: boolean; primary: boolean } => {
    // Sinov davrida PRO allaqachon bepul ochiq
    if (sub.isTrial && code === "pro") return { label: t("plan.trial_included"), disabled: true, primary: false };
    if (sub.isActive && sub.plan === code) {
      // Joriy tarif muddati tugashiga 7 kun qolganda uzaytirish mumkin
      return sub.endsAt && sub.daysLeft <= 7
        ? { label: t("plan.renew"), disabled: false, primary: true }
        : { label: t("plan.current"), disabled: true, primary: false };
    }
    return { label: t("plan.buy_plan", { plan: code.toUpperCase() }), disabled: false, primary: code === "pro" };
  };

  const historyStatus = (status: string) =>
    status === "completed"
      ? { label: t("plan.hist_completed"), color: colors.primary }
      : status === "failed"
        ? { label: t("plan.hist_failed"), color: colors.error }
        : { label: t("plan.hist_waiting"), color: colors.tertiary };

  const pay = async (method: PayMethod) => {
    if (!sheetPlan) return;
    const ok = await checkout.start(sheetPlan, cycle, method);
    if (ok) setSheetPlan(null);
    else showToast(t("plan.checkout_failed"), "error");
  };

  const closeSheet = () => {
    if (!checkout.starting) setSheetPlan(null);
  };

  return (
    <Screen onRefresh={() => Promise.all([reloadProvider(), checkout.reload()])}>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{t("plan.title")}</Text>
          <Text style={styles.subtitle}>{t("plan.sub")}</Text>
        </View>
      </View>

      {providerLoading && !provider ? (
        <Spinner />
      ) : (
        <>
          {/* Joriy holat */}
          <Card style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View style={[styles.iconBox, { backgroundColor: alpha(statusColor, 0.14) }]}>
                {sub.plan === "plus" && !sub.isTrial ? (
                  <Zap size={17} color={statusColor} />
                ) : (
                  <Crown size={17} color={statusColor} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.caption}>{t("plan.current_label")}</Text>
                <Text style={styles.statusTitle} numberOfLines={1}>
                  {statusTitle}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: alpha(statusColor, 0.14) }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusBadge}</Text>
              </View>
            </View>

            <View style={styles.statusNumbers}>
              {sub.endsAt || sub.isTrial ? (
                <>
                  <Text style={[styles.bigValue, sub.isExpired && { color: colors.error }]}>{sub.daysLeft}</Text>
                  <Text style={styles.bigSuffix}>{t("plan.days_left_short")}</Text>
                </>
              ) : (
                <Text style={styles.bigSuffix}>{t("plan.no_expiry")}</Text>
              )}
              <View style={{ flex: 1 }} />
              {sub.endsAt ? <Text style={styles.endsText}>{t("plan.ends_on", { date: fmtDate(sub.endsAt) })}</Text> : null}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: statusColor }]}
              />
            </View>
            {sub.isExpired ? <Text style={styles.statusHint}>{t("plan.expired_desc")}</Text> : null}
          </Card>

          {/* To'lov kutilmoqda — Click/Payme'dan qaytishini kutadi */}
          {PURCHASE_ENABLED && checkout.pending ? (
            <Card style={styles.waitCard}>
              <View style={styles.waitTop}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.waitTitle}>
                  {t("plan.waiting", { method: methodLabel(checkout.pending.method) })}
                </Text>
              </View>
              <Text style={styles.waitHint}>{t("plan.waiting_hint")}</Text>
              <View style={styles.waitActions}>
                <SmallButton label={t("plan.reopen")} onPress={checkout.reopen} style={{ flex: 1 }} />
                <SmallButton label={t("common.cancel")} variant="outline" onPress={checkout.cancel} />
              </View>
            </Card>
          ) : null}

          {/* Davr tanlovi — faqat sotib olish mumkin bo'lgan platformada */}
          {PURCHASE_ENABLED ? (
          <View style={styles.cycleRow}>
            <Text style={styles.sectionLabel}>{t("plan.choose")}</Text>
            <View style={styles.segTrack}>
              {(["monthly", "yearly"] as const).map((c) => {
                const active = cycle === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCycle(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.segItem, active && styles.segItemActive]}
                  >
                    <Text style={[styles.segText, { color: active ? colors.primary : colors.onSurfaceVariant }]}>
                      {t(c === "monthly" ? "plan.cycle_monthly" : "plan.cycle_yearly")}
                    </Text>
                    {c === "yearly" ? (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveText}>−20%</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
          ) : null}

          {/* Tariflar */}
          <Card>
            {(["plus", "pro"] as const).map((code, i) => {
              const price = PLAN_PRICES[code][cycle];
              const action = planAction(code);
              const Icon = code === "pro" ? Crown : Zap;
              return (
                <View key={code} style={[styles.planBlock, i > 0 && styles.divider]}>
                  <View style={styles.planHead}>
                    <View style={[styles.iconBox, { backgroundColor: alpha(colors.primary, 0.14) }]}>
                      <Icon size={17} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.planNameRow}>
                        <Text style={styles.planName}>{t(`plan.name_${code}`)}</Text>
                        {code === "pro" ? (
                          <View style={[styles.badge, { backgroundColor: alpha(colors.primary, 0.14) }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>{t("plan.recommended")}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.planSub} numberOfLines={1}>
                        {t(code === "pro" ? "plan.pro_sub" : "plan.plus_sub")}
                      </Text>
                    </View>
                    {PURCHASE_ENABLED ? (
                      <View style={styles.priceCol}>
                        <Text style={styles.planPrice}>{formatSom(price)}</Text>
                        <Text style={styles.planPer}>{t(cycle === "yearly" ? "plan.per_year" : "plan.per_month")}</Text>
                      </View>
                    ) : null}
                  </View>

                  {PURCHASE_ENABLED && cycle === "yearly" ? (
                    <Text style={styles.planEq}>
                      {t("plan.yearly_monthly_eq", { amount: formatSom(Math.round(price / 12)) })}
                    </Text>
                  ) : null}

                  <View style={styles.featureList}>
                    {PLAN_FEATURES[code].map((f) => (
                      <View key={f.key} style={styles.featureRow}>
                        {f.on ? <Check size={13} color={colors.primary} /> : <Lock size={12} color={colors.outline} />}
                        <Text style={[styles.featureText, !f.on && { color: colors.outline }]}>{t(f.key)}</Text>
                      </View>
                    ))}
                  </View>

                  {PURCHASE_ENABLED ? (
                    <SmallButton
                      label={action.label}
                      variant={action.primary ? "primary" : "outline"}
                      disabled={action.disabled || !!checkout.pending}
                      onPress={() => setSheetPlan(code)}
                    />
                  ) : null}
                </View>
              );
            })}
          </Card>

          {PURCHASE_ENABLED ? (
            <View style={styles.secureRow}>
              <ShieldCheck size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.secureText}>{t("plan.secure_note")}</Text>
            </View>
          ) : null}

          {/* To'lovlar tarixi */}
          {checkout.history.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>{t("plan.history_title")}</Text>
              <Card>
                {checkout.history.map((h, i) => {
                  const st = historyStatus(h.status);
                  return (
                    <View key={h.id} style={[styles.histRow, i > 0 && styles.divider]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.histTitle}>
                          {h.plan_code.toUpperCase()} ·{" "}
                          {t((h.period_months ?? 1) >= 12 ? "plan.period_year" : "plan.period_month")}
                        </Text>
                        <Text style={styles.histSub} numberOfLines={1}>
                          {fmtDateTime(h.created_at)} · {methodLabel(h.payment_method)}
                        </Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text style={styles.histAmount}>
                          {formatSom(h.amount)} {t("pv.som")}
                        </Text>
                        <Text style={[styles.histStatus, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </>
      )}

      {/* To'lov usuli oynasi */}
      <Modal visible={!!sheetPlan} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.caption}>
                  {sheetPlan
                    ? `${t(`plan.name_${sheetPlan}`)} · ${t(cycle === "yearly" ? "plan.period_year" : "plan.period_month")}`
                    : ""}
                </Text>
                <Text style={styles.sheetAmount}>
                  {sheetPlan ? formatSom(PLAN_PRICES[sheetPlan][cycle]) : ""}{" "}
                  <Text style={styles.sheetCurrency}>{t("pv.som")}</Text>
                </Text>
              </View>
              <Pressable onPress={closeSheet} hitSlop={10} style={styles.sheetClose}>
                <X size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>{t("plan.method_title")}</Text>
            <View style={styles.methodList}>
              {METHODS.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => pay(m.id)}
                  disabled={!m.enabled || !!checkout.starting}
                  style={({ pressed }) => [
                    styles.methodRow,
                    i > 0 && styles.divider,
                    pressed && { backgroundColor: alpha(colors.onSurface, 0.05) },
                    !m.enabled && { opacity: 0.5 },
                  ]}
                >
                  <View style={[styles.methodLogo, { backgroundColor: m.color }]}>
                    <Text style={styles.methodLogoText}>{m.label}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.methodName}>{m.label}</Text>
                    {!m.enabled ? <Text style={styles.methodSub}>{t("plan.method_unavailable")}</Text> : null}
                  </View>
                  {checkout.starting === m.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <ChevronRight size={16} color={colors.outline} />
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetNote}>{t("plan.waiting_hint")}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { fontSize: 20, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

    caption: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 4,
    },
    iconBox: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm },
    badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
    priceCol: { alignItems: "flex-end" },

    // Joriy holat
    statusCard: { padding: 16, gap: 12 },
    statusTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    statusTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: 1 },
    statusNumbers: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    bigValue: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -1,
      fontVariant: ["tabular-nums"],
    },
    bigSuffix: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
    endsText: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: alpha(colors.outlineVariant, 0.6),
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 2 },
    statusHint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },

    // Kutilayotgan to'lov
    waitCard: { padding: 16, gap: 10, borderColor: alpha(colors.primary, 0.4) },
    waitTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    waitTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.onSurface },
    waitHint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
    waitActions: { flexDirection: "row", gap: 8 },

    // Davr tanlovi
    cycleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    segTrack: {
      flexDirection: "row",
      padding: 3,
      gap: 2,
      borderRadius: 10,
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.outlineVariant,
    },
    segItem: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    segItemActive: { backgroundColor: alpha(colors.primary, 0.16) },
    segText: { fontSize: 13, fontWeight: "700" },
    saveBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: alpha(colors.secondaryContainer, 0.25),
    },
    saveText: { fontSize: 10, fontWeight: "800", color: colors.secondary },

    // Tariflar
    planBlock: { padding: 16, gap: 12 },
    planHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    planName: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
    planSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    planPrice: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    planPer: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant },
    planEq: { fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: -4 },
    featureList: { gap: 7 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureText: { flex: 1, fontSize: 13, color: colors.onSurface },

    secureRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
    secureText: { flex: 1, fontSize: 11, color: colors.onSurfaceVariant, lineHeight: 16 },

    // Tarix
    histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    histTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
    histSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2, fontVariant: ["tabular-nums"] },
    histAmount: { fontSize: 13, fontWeight: "700", color: colors.onSurface, fontVariant: ["tabular-nums"] },
    histStatus: { fontSize: 11, fontWeight: "700", marginTop: 2 },

    // To'lov usuli oynasi
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surfaceContainerHigh,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 14,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: alpha(colors.onSurfaceVariant, 0.35),
    },
    sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    sheetAmount: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.onSurface,
      letterSpacing: -0.8,
      marginTop: 2,
      fontVariant: ["tabular-nums"],
    },
    sheetCurrency: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceVariant },
    sheetClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(colors.onSurface, 0.08),
    },
    methodList: {
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceContainer,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.outlineVariant,
    },
    methodRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    methodLogo: { width: 54, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    methodLogoText: { color: "#ffffff", fontWeight: "900", fontSize: 13 },
    methodName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
    methodSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
    sheetNote: { fontSize: 11, color: colors.onSurfaceVariant, textAlign: "center", lineHeight: 16 },
  })
);
