// Bank kartalari va Hamyon — provayder tushgan onlayn to'lovlarni (Click/Payme)
// ko'radi, to'g'ridan-to'g'ri o'z karta raqamini kiritib pul yechish so'rovlarini yuboradi va cheklarni ko'radi.
import { useRouter } from "expo-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Receipt,
  Wallet,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  EmptyState,
  GlassIconButton,
  GlassSurface,
  PaymentMethodBadge,
  SmallButton,
  Spinner,
  StatCard,
  StatusBadge,
} from "@/components/pv/ui";
import { alpha, radius, type BadgeTone } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { formatSom } from "@/utils/price";
import { sendTelegramPayoutAlert } from "@/utils/telegram";

interface PayoutItem {
  id: string;
  amount: number;
  card_number_masked: string;
  card_number_full?: string | null;
  card_holder_name: string | null;
  card_brand: string | null;
  status: "pending" | "completed" | "rejected" | "cancelled" | string;
  admin_notes: string | null;
  receipt_url?: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  booking_id: string;
  amount: number;
  method: "payme" | "click" | string;
  status: "created" | "paid" | "cancelled" | string;
  paid_at: string | null;
  created_at: string;
  booking_date: string | null;
  start_time: string | null;
  client_name: string | null;
}

function detectBrand(digits: string): string {
  if (digits.startsWith("8600")) return "UzCard";
  if (digits.startsWith("9860")) return "Humo";
  if (digits.startsWith("4")) return "Visa";
  if (digits.startsWith("5")) return "Mastercard";
  return "Karta";
}

function formatCardNumber(digits: string): string {
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

const PAYOUT_PRESETS = [50000, 100000, 250000, 500000];

export default function CardsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { provider } = useProvider();
  const providerId = provider?.id;

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"payouts" | "payments">("payouts");

  // Pul yechish (Withdraw) modal holati
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cardNumberDigits, setCardNumberDigits] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: payRows }, { data: payoutRows }] = await Promise.all([
      supabase
        .from("payments")
        .select("id, booking_id, amount, method, status, paid_at, created_at")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payout_requests")
        .select("*")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false }),
    ]);

    const pays = (payRows || []) as any[];
    const bookingIds = [...new Set(pays.map((p) => p.booking_id).filter(Boolean))];
    let bookings: Record<string, { booking_date: string; start_time: string; client_id: string }> = {};
    if (bookingIds.length > 0) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("id, booking_date, start_time, client_id")
        .in("id", bookingIds);
      bookings = Object.fromEntries((bks || []).map((b: any) => [b.id, b]));
    }
    const clientIds = [...new Set(Object.values(bookings).map((b) => b.client_id).filter(Boolean))];
    let names: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", clientIds);
      names = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
    }

    setPayouts((payoutRows || []) as PayoutItem[]);
    setPayments(
      pays.map((p) => {
        const b = bookings[p.booking_id];
        return {
          ...p,
          booking_date: b?.booking_date || null,
          start_time: b?.start_time || null,
          client_name: b ? names[b.client_id] || null : null,
        };
      })
    );
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    const tm = setTimeout(load, 0);
    return () => clearTimeout(tm);
  }, [load]);

  // Hisob-kitoblar
  const paidPayments = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);
  const clickTotal = useMemo(
    () => paidPayments.filter((p) => p.method === "click").reduce((s, p) => s + Number(p.amount || 0), 0),
    [paidPayments]
  );
  const paymeTotal = useMemo(
    () => paidPayments.filter((p) => p.method === "payme").reduce((s, p) => s + Number(p.amount || 0), 0),
    [paidPayments]
  );
  const cashTotal = useMemo(
    () => paidPayments.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount || 0), 0),
    [paidPayments]
  );
  const totalOnlineEarned = clickTotal + paymeTotal;

  const withdrawnTotal = useMemo(
    () => payouts.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount || 0), 0),
    [payouts]
  );
  const pendingTotal = useMemo(
    () => payouts.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0),
    [payouts]
  );
  const availableBalance = Math.max(0, totalOnlineEarned - withdrawnTotal - pendingTotal);

  const openWithdrawModal = () => {
    if (availableBalance < 10000) {
      showToast(t("cards.err_insufficient"), "error");
      return;
    }
    setWithdrawAmount("");
    if (!cardNumberDigits && payouts.length > 0 && payouts[0].card_number_full) {
      setCardNumberDigits(payouts[0].card_number_full);
      setCardHolder(payouts[0].card_holder_name || "");
    }
    setWithdrawOpen(true);
  };

  const handleWithdrawSubmit = async () => {
    const cleanCard = cardNumberDigits.replace(/\D/g, "");
    if (cleanCard.length !== 16) {
      showToast(t("cards.invalid_number"), "error");
      return;
    }

    const amount = Number(withdrawAmount);
    if (!amount || amount < 10000) {
      showToast(t("cards.err_min_amount"), "error");
      return;
    }
    if (amount > availableBalance) {
      showToast(t("cards.err_insufficient"), "error");
      return;
    }

    if (!providerId) return;

    setSubmittingWithdraw(true);
    try {
      const cardBrand = detectBrand(cleanCard);
      const maskedNumber = `•••• •••• •••• ${cleanCard.slice(-4)}`;
      const holderName = (cardHolder.trim() || provider?.business_name || "Provayder").toUpperCase();

      const { data: newPayout, error } = await supabase
        .from("payout_requests")
        .insert({
          provider_id: providerId,
          amount: Math.round(amount),
          card_number_masked: maskedNumber,
          card_number_full: cleanCard,
          card_holder_name: holderName,
          card_brand: cardBrand,
          status: "pending",
        })
        .select("*")
        .single();

      if (error || !newPayout) {
        showToast(t("cards.save_failed"), "error");
        return;
      }

      // Telegram bildirishnoma jo'natamiz
      sendTelegramPayoutAlert({
        payoutId: newPayout.id,
        businessName: typeof provider.business_name === "string" ? provider.business_name : "Biznes",
        businessSlug: provider.slug || providerId.slice(0, 8),
        ownerName: holderName,
        ownerPhone: provider.phone_number || "",
        cardNumberMasked: maskedNumber,
        cardNumberFull: cleanCard,
        cardHolderName: holderName,
        cardBrand: cardBrand,
        amountSom: Math.round(amount),
        createdAt: newPayout.created_at,
      }).catch((e) => console.error("[Telegram Payout Alert Catch]", e));

      showToast(t("cards.withdraw_success"), "success");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setTab("payouts");
      await load();
    } catch {
      showToast(t("cards.save_failed"), "error");
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const payoutStatusBadge = (status: string): { label: string; tone: BadgeTone } => {
    if (status === "completed") return { label: t("cards.payout_status_completed"), tone: "primary" };
    if (status === "rejected") return { label: t("cards.payout_status_rejected"), tone: "error" };
    return { label: t("cards.payout_status_pending"), tone: "secondary" };
  };

  return (
    <Screen scroll={true}>
      {/* Sarlavha va Orqaga */}
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>{t("cards.title")}</Text>
          <Text style={styles.sub}>{t("cards.sub")}</Text>
        </View>
        <TouchableOpacity
          onPress={openWithdrawModal}
          disabled={availableBalance < 10000}
          style={[styles.headerWithdrawBtn, availableBalance < 10000 && styles.btnDisabled]}
        >
          <ArrowDownToLine size={14} color={colors.onPrimary} />
          <Text style={styles.headerWithdrawBtnText}>{t("cards.withdraw_btn")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <Spinner />
        </View>
      ) : (
        <View style={styles.content}>
          {/* 1. Moliya va Balans Paneli */}
          {/* Mavjud Balans (Asosiy Karta) */}
          <GlassSurface style={styles.balanceCard} tintColor={alpha(colors.primary, 0.16)}>
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>{t("cards.available_balance")}</Text>
              <View style={styles.walletIconWrap}>
                <Wallet size={18} color={colors.primary} />
              </View>
            </View>
            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceValue}>{formatSom(availableBalance)}</Text>
              <Text style={styles.balanceSuffix}>UZS</Text>
            </View>
            <Text style={styles.balanceDesc}>{t("cards.available_desc")}</Text>

            <TouchableOpacity
              onPress={openWithdrawModal}
              disabled={availableBalance < 10000}
              style={[styles.balanceWithdrawBtn, availableBalance < 10000 && styles.btnDisabled]}
            >
              <ArrowDownToLine size={16} color={colors.onPrimary} />
              <Text style={styles.balanceWithdrawBtnText}>{t("cards.withdraw_btn")}</Text>
            </TouchableOpacity>
          </GlassSurface>

          {/* Ko'rsatkichlar (Grid) */}
          <View style={styles.statsGrid}>
            {/* Onlayn Tushumlar (Click + Payme Breakdown) */}
            <GlassSurface style={styles.statBox}>
              <View style={styles.statBoxTop}>
                <Text style={styles.statBoxLabel}>{t("cards.online_collected")}</Text>
                <View style={[styles.statIconWrap, { backgroundColor: alpha(colors.primary, 0.15) }]}>
                  <Receipt size={14} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.statBoxValue}>
                {formatSom(totalOnlineEarned)} <Text style={styles.statBoxSuffix}>{t("cards.som")}</Text>
              </Text>
              <View style={styles.statBreakdownRow}>
                <Text style={[styles.breakdownText, { color: "#3b82f6" }]}>
                  Click: {formatSom(clickTotal)}
                </Text>
                <Text style={styles.breakdownDot}>·</Text>
                <Text style={[styles.breakdownText, { color: "#0d9488" }]}>
                  Payme: {formatSom(paymeTotal)}
                </Text>
              </View>
            </GlassSurface>

            {/* Yechib Olingan Jami */}
            <StatCard
              label={t("cards.withdrawn_total")}
              value={formatSom(withdrawnTotal) || "0"}
              suffix={t("cards.som")}
              icon={CheckCircle2}
              tone="secondary"
            />
          </View>

          {/* Kutilayotgan so'rovlar (agar bo'lsa) */}
          {pendingTotal > 0 && (
            <StatCard
              label={t("cards.pending_payouts")}
              value={formatSom(pendingTotal) || "0"}
              suffix={t("cards.som")}
              icon={Clock}
              tone="secondary"
            />
          )}

          {/* 2. Tarix Segmenti (Tabs) */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              onPress={() => setTab("payouts")}
              style={[styles.tabBtn, tab === "payouts" && styles.tabBtnActive]}
            >
              <ArrowDownToLine
                size={14}
                color={tab === "payouts" ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <Text style={[styles.tabBtnText, tab === "payouts" && styles.tabBtnTextActive]}>
                {t("cards.payout_history")}
              </Text>
              {payouts.length > 0 && (
                <View style={[styles.tabBadge, tab === "payouts" && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, tab === "payouts" && styles.tabBadgeTextActive]}>
                    {payouts.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab("payments")}
              style={[styles.tabBtn, tab === "payments" && styles.tabBtnActive]}
            >
              <Receipt
                size={14}
                color={tab === "payments" ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <Text style={[styles.tabBtnText, tab === "payments" && styles.tabBtnTextActive]}>
                {t("cards.history")}
              </Text>
              {payments.length > 0 && (
                <View style={[styles.tabBadge, tab === "payments" && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, tab === "payments" && styles.tabBadgeTextActive]}>
                    {payments.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Tab 1: Pul Yechish Tarixi */}
          {tab === "payouts" ? (
            payouts.length === 0 ? (
              <GlassSurface style={styles.emptyCard}>
                <EmptyState
                  icon={ArrowDownToLine}
                  title={t("cards.payout_history_empty")}
                  desc={t("cards.payout_history_empty_desc")}
                />
              </GlassSurface>
            ) : (
              <View style={styles.payoutList}>
                {payouts.map((item) => {
                  const badge = payoutStatusBadge(item.status);
                  return (
                    <GlassSurface key={item.id} style={styles.payoutItem}>
                      <View style={styles.payoutItemTop}>
                        <View style={styles.payoutAmountCol}>
                          <Text style={styles.payoutAmount}>{formatSom(item.amount)} so'm</Text>
                          <Text style={styles.payoutDate}>
                            {new Date(item.created_at).toLocaleDateString("uz-UZ", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <StatusBadge label={badge.label} tone={badge.tone} />
                      </View>

                      <View style={styles.payoutCardRow}>
                        <CreditCard size={14} color={colors.onSurfaceVariant} />
                        <Text style={styles.payoutCardText}>{item.card_number_masked}</Text>
                        {item.card_brand && (
                          <Text style={styles.payoutBrandText}>({item.card_brand})</Text>
                        )}
                      </View>

                      {item.admin_notes && (
                        <Text style={styles.payoutNotesText}>{item.admin_notes}</Text>
                      )}

                      {item.receipt_url && (
                        <TouchableOpacity
                          onPress={() => setViewingReceiptUrl(item.receipt_url!)}
                          style={styles.receiptBtn}
                        >
                          <Receipt size={13} color={colors.primary} />
                          <Text style={styles.receiptBtnText}>{t("cards.receipt_view")}</Text>
                        </TouchableOpacity>
                      )}
                    </GlassSurface>
                  );
                })}
              </View>
            )
          ) : (
            /* Tab 2: Mijozlar To'lovlari */
            payments.length === 0 ? (
              <GlassSurface style={styles.emptyCard}>
                <EmptyState
                  icon={Receipt}
                  title={t("cards.history_empty")}
                  desc={t("cards.history_empty_desc")}
                />
              </GlassSurface>
            ) : (
              <View style={styles.paymentList}>
                {payments.map((p) => (
                  <GlassSurface key={p.id} style={styles.paymentItem}>
                    <View style={styles.paymentItemLeft}>
                      <View style={styles.paymentAmountRow}>
                        <Text style={styles.paymentAmount}>+{formatSom(p.amount)} {t("cards.som")}</Text>
                        <PaymentMethodBadge method={p.method} />
                      </View>
                      <Text style={styles.paymentSub}>
                        {p.client_name ? `${p.client_name} · ` : ""}
                        {t("cards.booking_for")} {shortDate(p.booking_date)}
                        {p.start_time ? ` ${p.start_time.slice(0, 5)}` : ""}
                      </Text>
                    </View>
                  </GlassSurface>
                ))}
              </View>
            )
          )}
        </View>
      )}

      {/* 3. Pul Yechish Modali */}
      <Modal visible={withdrawOpen} transparent={true} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <ArrowDownToLine size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>{t("cards.withdraw_dialog_title")}</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Mavjud Balans Box */}
              <View style={styles.modalBalanceBox}>
                <Text style={styles.modalBalanceLabel}>Mavjud Balans:</Text>
                <Text style={styles.modalBalanceVal}>{formatSom(availableBalance)} so'm</Text>
              </View>

              {/* Karta Raqami */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{t("cards.number")}</Text>
                  {cardNumberDigits.length >= 4 && (
                    <Text style={styles.brandBadge}>{detectBrand(cardNumberDigits)}</Text>
                  )}
                </View>
                <TextInput
                  value={formatCardNumber(cardNumberDigits)}
                  onChangeText={(val) => setCardNumberDigits(val.replace(/\D/g, "").slice(0, 16))}
                  keyboardType="numeric"
                  placeholder="8600 0000 0000 0000"
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={styles.modalInput}
                />
                <Text style={styles.inputHint}>Pul aynan shu plastik karta raqamiga o'tkazib beriladi.</Text>
              </View>

              {/* Karta Egasi */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("cards.holder")}</Text>
                <TextInput
                  value={cardHolder}
                  onChangeText={(val) => setCardHolder(val.toUpperCase())}
                  placeholder={t("cards.holder_ph")}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={styles.modalInput}
                />
              </View>

              {/* Yechish Summasi */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t("cards.withdraw_amount_label")}</Text>
                <TextInput
                  value={withdrawAmount ? formatSom(withdrawAmount) : ""}
                  onChangeText={(val) => setWithdrawAmount(val.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  placeholder="100 000"
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.modalInput, styles.amountInput]}
                />
                <Text style={styles.inputHint}>
                  {t("cards.withdraw_min_hint", { min: "10 000" })}
                </Text>

                {/* Preset Chiplari */}
                <View style={styles.presetRow}>
                  {PAYOUT_PRESETS.map((amt) => {
                    const disabled = amt > availableBalance;
                    return (
                      <TouchableOpacity
                        key={amt}
                        disabled={disabled}
                        onPress={() => setWithdrawAmount(String(amt))}
                        style={[
                          styles.presetChip,
                          Number(withdrawAmount) === amt && styles.presetChipActive,
                          disabled && styles.presetChipDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            Number(withdrawAmount) === amt && styles.presetChipTextActive,
                          ]}
                        >
                          {formatSom(amt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    disabled={availableBalance < 10000}
                    onPress={() => setWithdrawAmount(String(Math.round(availableBalance)))}
                    style={[styles.presetChip, styles.presetChipAll]}
                  >
                    <Text style={styles.presetChipAllText}>{t("cards.withdraw_all")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoNotice}>
                <Text style={styles.infoNoticeText}>
                  ℹ️ So'rov yuborilgach, adminlarimiz kartangizga pul o'tkazib berishadi va to'lov chekini biriktirishadi.
                </Text>
              </View>

              {/* Amallar */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setWithdrawOpen(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelBtnText}>{t("common.cancel")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={
                    submittingWithdraw ||
                    cardNumberDigits.replace(/\D/g, "").length !== 16 ||
                    !withdrawAmount ||
                    Number(withdrawAmount) < 10000 ||
                    Number(withdrawAmount) > availableBalance
                  }
                  onPress={handleWithdrawSubmit}
                  style={[
                    styles.modalSubmitBtn,
                    (submittingWithdraw ||
                      cardNumberDigits.replace(/\D/g, "").length !== 16 ||
                      !withdrawAmount ||
                      Number(withdrawAmount) < 10000 ||
                      Number(withdrawAmount) > availableBalance) &&
                      styles.btnDisabled,
                  ]}
                >
                  {submittingWithdraw ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <ArrowDownToLine size={16} color={colors.onPrimary} />
                      <Text style={styles.modalSubmitBtnText}>{t("cards.withdraw_submit")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. Chekni Ko'rish Modali */}
      <Modal visible={!!viewingReceiptUrl} transparent={true} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Receipt size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>To'lov Cheki</Text>
              </View>
              <TouchableOpacity
                onPress={() => setViewingReceiptUrl(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {viewingReceiptUrl && (
              <View style={styles.receiptImageWrap}>
                <Image
                  source={{ uri: viewingReceiptUrl }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    headerTextCol: { flex: 1 },
    title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
    sub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
    headerWithdrawBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
    },
    headerWithdrawBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
    btnDisabled: { opacity: 0.4 },

    loadingWrap: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
    content: { gap: 14 },

    // Mavjud Balans Card
    balanceCard: {
      padding: 16,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.3),
    },
    balanceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    balanceLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    walletIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: alpha(colors.primary, 0.15),
      alignItems: "center",
      justifyContent: "center",
    },
    balanceValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
    balanceValue: { fontSize: 28, fontWeight: "900", color: colors.onSurface },
    balanceSuffix: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceVariant },
    balanceDesc: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
    balanceWithdrawBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: radius.md,
      marginTop: 14,
    },
    balanceWithdrawBtnText: { color: colors.onPrimary, fontSize: 13, fontWeight: "800" },

    // Stats Grid
    statsGrid: { flexDirection: "row", gap: 10 },
    statBox: {
      flex: 1,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    statBoxTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statBoxLabel: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant, flex: 1 },
    statIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    statBoxValue: { fontSize: 17, fontWeight: "800", color: colors.onSurface, marginTop: 6 },
    statBoxSuffix: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant },
    statBreakdownRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    breakdownText: { fontSize: 10, fontWeight: "700" },
    breakdownDot: { fontSize: 10, color: colors.onSurfaceVariant },

    // Tabs
    tabsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
    tabBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabBtnText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceVariant },
    tabBtnTextActive: { color: colors.onPrimary },
    tabBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 99,
      backgroundColor: colors.surfaceContainerHighest,
    },
    tabBadgeActive: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
    tabBadgeText: { fontSize: 10, fontWeight: "700", color: colors.onSurface },
    tabBadgeTextActive: { color: colors.onPrimary },

    // Payout List
    payoutList: { gap: 10 },
    payoutItem: {
      padding: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: 8,
    },
    payoutItemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    payoutAmountCol: { gap: 2 },
    payoutAmount: { fontSize: 16, fontWeight: "800", color: colors.primary },
    payoutDate: { fontSize: 11, color: colors.onSurfaceVariant },
    payoutCardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    payoutCardText: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
    payoutBrandText: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceVariant },
    payoutNotesText: { fontSize: 12, color: colors.onSurfaceVariant, fontStyle: "italic" },
    receiptBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: alpha(colors.primary, 0.12),
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.25),
      marginTop: 2,
    },
    receiptBtnText: { fontSize: 11, fontWeight: "700", color: colors.primary },

    // Payment List
    paymentList: { gap: 8 },
    paymentItem: {
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    paymentItemLeft: { gap: 4 },
    paymentAmountRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    paymentAmount: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
    paymentSub: { fontSize: 11, color: colors.onSurfaceVariant },

    emptyCard: { padding: 24, borderRadius: radius.lg, alignItems: "center" },

    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.surfaceContainer,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: 20,
      maxHeight: "88%",
      gap: 12,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
    modalCloseBtn: { padding: 6 },
    modalBalanceBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: alpha(colors.primary, 0.12),
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.25),
      marginVertical: 6,
    },
    modalBalanceLabel: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceVariant },
    modalBalanceVal: { fontSize: 15, fontWeight: "900", color: colors.primary },

    inputGroup: { marginTop: 10, gap: 4 },
    inputLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    inputLabel: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceVariant, textTransform: "uppercase" },
    brandBadge: { fontSize: 11, fontWeight: "800", color: colors.primary },
    modalInput: {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      fontWeight: "700",
      color: colors.onSurface,
    },
    amountInput: { fontSize: 18, fontWeight: "900" },
    inputHint: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    presetChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLowest,
    },
    presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetChipDisabled: { opacity: 0.4 },
    presetChipText: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceVariant },
    presetChipTextActive: { color: colors.onPrimary },
    presetChipAll: { backgroundColor: alpha(colors.primary, 0.12), borderColor: alpha(colors.primary, 0.3) },
    presetChipAllText: { fontSize: 11, fontWeight: "800", color: colors.primary },

    infoNotice: {
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceContainerHighest,
      marginTop: 12,
    },
    infoNoticeText: { fontSize: 11, color: colors.onSurfaceVariant, lineHeight: 16 },

    modalActions: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 20 },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    modalCancelBtnText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceVariant },
    modalSubmitBtn: {
      flex: 1.4,
      paddingVertical: 13,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    modalSubmitBtnText: { fontSize: 13, fontWeight: "800", color: colors.onPrimary },

    // Receipt Modal
    receiptModalCard: {
      backgroundColor: colors.surfaceContainer,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: 20,
      maxHeight: "80%",
      gap: 12,
    },
    receiptImageWrap: {
      height: 380,
      width: "100%",
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.surfaceContainerLowest,
      alignItems: "center",
      justifyContent: "center",
    },
    receiptImage: { width: "100%", height: "100%" },
  })
);
