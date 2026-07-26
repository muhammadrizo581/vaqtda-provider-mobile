// Bank kartalari — provayder to'lovlarni qabul qiladigan kartalarini boshqaradi.
// Karta raqami to'liq saqlanmaydi: faqat oxirgi 4 raqam + brend (PCI talabi).
// Karta SMS-OTP bilan tasdiqlanadi: request_card_otp → kod → verify_card_otp.
// OTP tasdiqlanmasa karta qo'shilmaydi (DB'da to'g'ridan-to'g'ri INSERT yopiq).
// Pastda mijozlardan tushgan to'lovlar tarixi va umumiy balans ko'rsatiladi.
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CreditCard,
  MessageSquareLock,
  Plus,
  Receipt,
  Star,
  Trash2,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  Card,
  EmptyState,
  GlassIconButton,
  GlassSurface,
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

interface ProviderCard {
  id: string;
  holder_name: string;
  card_last4: string;
  card_brand: string;
  expiry: string; // MM/YY
  is_default: boolean;
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

// Karta raqami prefiksidan brendni aniqlash (raqamning o'zi saqlanmaydi)
function detectBrand(digits: string): string {
  if (digits.startsWith("8600")) return "UzCard";
  if (digits.startsWith("9860")) return "Humo";
  if (digits.startsWith("4")) return "Visa";
  if (digits.startsWith("5")) return "Mastercard";
  return "Karta";
}

// "8600123412341234" -> "8600 1234 1234 1234"
function formatCardNumber(digits: string): string {
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

// "0728" -> "07/28"
function formatExpiry(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

// "25.07" kabi qisqa sana (bron sanasi uchun)
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export default function CardsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { provider } = useProvider();
  const providerId = provider?.id;

  const [cards, setCards] = useState<ProviderCard[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Karta qo'shish formasi (step: form → otp)
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [numberDigits, setNumberDigits] = useState("");
  const [expiryDigits, setExpiryDigits] = useState("");
  const [holder, setHolder] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // OTP bosqichi. otpVia: "payme" — real Subscribe API (edge funksiya),
  // "mock" — DB'dagi test RPC (Payme kalitlari ulanmaguncha).
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpPhoneMask, setOtpPhoneMask] = useState("");
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpVia, setOtpVia] = useState<"payme" | "mock">("mock");

  const load = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: cardRows }, { data: payRows }] = await Promise.all([
      supabase
        .from("provider_cards")
        .select("id, holder_name, card_last4, card_brand, expiry, is_default")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select("id, booking_id, amount, method, status, paid_at, created_at")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // To'lov qaysi bron uchun — sana/vaqt va mijoz ismini alohida so'raymiz
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

    setCards((cardRows || []) as ProviderCard[]);
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

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const tm = setTimeout(load, 0);
    return () => clearTimeout(tm);
  }, [load]);

  const paidPayments = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);
  const balance = useMemo(() => paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0), [paidPayments]);

  const resetForm = () => {
    setFormOpen(false);
    setStep("form");
    setNumberDigits("");
    setExpiryDigits("");
    setHolder("");
    setOtpRequestId(null);
    setOtpPhoneMask("");
    setOtpDevCode(null);
    setOtpCode("");
  };

  // OTP xatolarini xabarga aylantirish
  const otpError = (code: string): string => {
    switch (code) {
      case "no_phone": return t("cards.err_no_phone");
      case "wrong_code": return t("cards.err_wrong_code");
      case "code_expired": return t("cards.err_expired");
      case "too_many_attempts": return t("cards.err_attempts");
      case "bad_number": return t("cards.invalid_number");
      case "bad_expiry": return t("cards.invalid_expiry");
      case "bad_holder": return t("cards.invalid_holder");
      default: return t("cards.save_failed");
    }
  };

  // 1-bosqich: kartani tekshirib, bog'langan raqamga SMS kod so'raymiz.
  // Avval REAL yo'l (payme-cards edge funksiyasi, Payme Subscribe API —
  // protsessing kartaga bog'langan raqamga SMS yuboradi). Kalitlar ulanmagan
  // bo'lsa mock RPC'ga qaytamiz. To'liq raqam DB'da hech qachon saqlanmaydi.
  const requestOtp = async () => {
    if (!providerId) return;
    if (numberDigits.length !== 16) {
      showToast(t("cards.invalid_number"), "error");
      return;
    }
    const mm = Number(expiryDigits.slice(0, 2));
    if (expiryDigits.length !== 4 || mm < 1 || mm > 12) {
      showToast(t("cards.invalid_expiry"), "error");
      return;
    }
    if (!holder.trim()) {
      showToast(t("cards.invalid_holder"), "error");
      return;
    }
    setSaving(true);

    // Real yo'l: Payme Subscribe API
    let data: any = null;
    try {
      const res = await supabase.functions.invoke("payme-cards", {
        body: {
          action: "create",
          number: numberDigits,
          expiry: formatExpiry(expiryDigits),
          holder: holder.trim(),
        },
      });
      data = res.data;
    } catch {
      data = null; // funksiya deploy qilinmagan — mock'ka o'tamiz
    }

    if (data?.ok) {
      setOtpVia("payme");
      setOtpDevCode(null); // real SMS — kod ekranda ko'rinmaydi
    } else if (!data || data?.error === "not_configured") {
      // Mock yo'l: kod DB'da yaratiladi, test rejimida ekranda ko'rinadi
      const res = await supabase.rpc("request_card_otp", {
        p_card_number: numberDigits,
        p_expiry: formatExpiry(expiryDigits),
        p_holder: holder.trim(),
      });
      data = res.error ? null : res.data;
      if (!data?.ok) {
        setSaving(false);
        showToast(otpError(data?.error || ""), "error");
        return;
      }
      setOtpVia("mock");
      setOtpDevCode(data.dev_code || null);
    } else {
      setSaving(false);
      showToast(otpError(data?.error || ""), "error");
      return;
    }

    setSaving(false);
    setOtpRequestId(data.request_id);
    setOtpPhoneMask(data.phone_mask || "");
    setOtpCode("");
    setStep("otp");
    showToast(t("cards.otp_sent_toast"));
  };

  // 2-bosqich: kod tekshiriladi — to'g'ri bo'lsa karta server tomonda qo'shiladi
  const verifyOtp = async () => {
    if (!otpRequestId || otpCode.length !== 6) {
      showToast(t("cards.err_wrong_code"), "error");
      return;
    }
    setSaving(true);
    let data: any = null;
    if (otpVia === "payme") {
      try {
        const res = await supabase.functions.invoke("payme-cards", {
          body: { action: "verify", request_id: otpRequestId, code: otpCode },
        });
        data = res.data;
      } catch {
        data = null;
      }
    } else {
      const res = await supabase.rpc("verify_card_otp", {
        p_request_id: otpRequestId,
        p_code: otpCode,
      });
      data = res.error ? null : res.data;
    }
    setSaving(false);
    if (!data?.ok) {
      const code = data?.error || "";
      showToast(otpError(code), "error");
      // Muddati o'tgan/urinishlar tugagan — forma bosqichiga qaytamiz
      if (code === "code_expired" || code === "too_many_attempts" || code === "request_not_found") {
        setStep("form");
        setOtpCode("");
      }
      return;
    }
    showToast(t("cards.added"));
    resetForm();
    load();
  };

  const removeCard = async (id: string) => {
    setDeleteId(null);
    const wasDefault = cards.find((c) => c.id === id)?.is_default;
    const { error } = await supabase.from("provider_cards").delete().eq("id", id);
    if (error) {
      showToast(t("cards.save_failed"), "error");
      return;
    }
    // Asosiy karta o'chirilsa — qolganlardan birinchisini asosiy qilamiz
    const rest = cards.filter((c) => c.id !== id);
    if (wasDefault && rest.length > 0) {
      await supabase.from("provider_cards").update({ is_default: true }).eq("id", rest[0].id);
    }
    showToast(t("cards.deleted"));
    load();
  };

  const setDefault = async (id: string) => {
    if (!providerId) return;
    // Avval eskisini bo'shatamiz (bitta default — unique index talabi)
    await supabase.from("provider_cards").update({ is_default: false }).eq("provider_id", providerId).eq("is_default", true);
    const { error } = await supabase.from("provider_cards").update({ is_default: true }).eq("id", id);
    if (error) {
      showToast(t("cards.save_failed"), "error");
      return;
    }
    setCards((prev) => prev.map((c) => ({ ...c, is_default: c.id === id })));
  };

  const statusBadge = (status: string): { label: string; tone: BadgeTone } => {
    if (status === "paid") return { label: t("cards.status_paid"), tone: "primary" };
    if (status === "cancelled") return { label: t("cards.status_cancelled"), tone: "error" };
    return { label: t("cards.status_created"), tone: "secondary" };
  };

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("cards.title")}</Text>
          <Text style={styles.subtitle}>{t("cards.sub")}</Text>
        </View>
      </View>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Balans: mijozlardan tushgan to'lovlar */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard
              label={t("cards.balance")}
              value={formatSom(balance) || "0"}
              suffix={t("cards.som")}
              icon={Wallet}
              tone="primary"
            />
            <StatCard
              label={t("cards.payments_count")}
              value={paidPayments.length}
              icon={Receipt}
              tone="secondary"
            />
          </View>

          {/* Kartalar ro'yxati */}
          {cards.length === 0 && !formOpen ? (
            <EmptyState icon={CreditCard} title={t("cards.empty")} desc={t("cards.empty_desc")} />
          ) : (
            <View style={{ gap: 10 }}>
              {cards.map((c) => (
                <Card key={c.id} style={styles.cardRow}>
                  <View style={[styles.cardIcon, { backgroundColor: alpha(colors.primaryContainer, 0.2) }]}>
                    <CreditCard size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.cardNumber} numberOfLines={1}>
                        {c.card_brand} •••• {c.card_last4}
                      </Text>
                      {c.is_default && <StatusBadge label={t("cards.default")} tone="primary" />}
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {c.holder_name} · {c.expiry}
                    </Text>
                  </View>
                  {!c.is_default && (
                    <SmallButton label="" icon={Star} variant="outline" onPress={() => setDefault(c.id)} />
                  )}
                  {deleteId === c.id ? (
                    <SmallButton label={t("cards.delete_q")} variant="error" onPress={() => removeCard(c.id)} />
                  ) : (
                    <SmallButton label="" icon={Trash2} variant="error" onPress={() => setDeleteId(c.id)} />
                  )}
                </Card>
              ))}
            </View>
          )}

          {/* Karta qo'shish: 1) rekvizitlar → 2) SMS kod */}
          {formOpen ? (
            step === "form" ? (
              <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
                <View>
                  <Text style={styles.label}>{t("cards.number")}</Text>
                  <TextInput
                    value={formatCardNumber(numberDigits)}
                    onChangeText={(v) => setNumberDigits(v.replace(/[^\d]/g, "").slice(0, 16))}
                    keyboardType="numeric"
                    placeholder="8600 0000 0000 0000"
                    placeholderTextColor={colors.outline}
                    style={styles.input}
                  />
                  {numberDigits.length >= 4 && (
                    <Text style={styles.brandHint}>{detectBrand(numberDigits)}</Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 110 }}>
                    <Text style={styles.label}>{t("cards.expiry")}</Text>
                    <TextInput
                      value={formatExpiry(expiryDigits)}
                      onChangeText={(v) => setExpiryDigits(v.replace(/[^\d]/g, "").slice(0, 4))}
                      keyboardType="numeric"
                      placeholder="MM/YY"
                      placeholderTextColor={colors.outline}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t("cards.holder")}</Text>
                    <TextInput
                      value={holder}
                      onChangeText={setHolder}
                      autoCapitalize="characters"
                      placeholder={t("cards.holder_ph")}
                      placeholderTextColor={colors.outline}
                      style={styles.input}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <SmallButton label={t("common.cancel")} variant="outline" onPress={resetForm} style={{ flex: 1 }} />
                  <SmallButton label={t("cards.get_code")} loading={saving} onPress={requestOtp} style={{ flex: 1 }} />
                </View>
              </GlassSurface>
            ) : (
              <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MessageSquareLock size={16} color={colors.primary} />
                  <Text style={styles.sectionTitle}>{t("cards.otp_title")}</Text>
                </View>
                <Text style={styles.otpSent}>
                  {t("cards.otp_sent", { phone: otpPhoneMask })}
                </Text>
                {/* SMS shlyuz ulanmaguncha test rejim: kod ekranda ko'rinadi */}
                {otpDevCode ? (
                  <Text style={styles.devCode}>{t("cards.otp_dev", { code: otpDevCode })}</Text>
                ) : null}
                <View>
                  <Text style={styles.label}>{t("cards.otp_code")}</Text>
                  <TextInput
                    value={otpCode}
                    onChangeText={(v) => setOtpCode(v.replace(/[^\d]/g, "").slice(0, 6))}
                    keyboardType="numeric"
                    placeholder="••••••"
                    placeholderTextColor={colors.outline}
                    style={[styles.input, styles.otpInput]}
                    autoFocus
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <SmallButton label={t("common.cancel")} variant="outline" onPress={resetForm} style={{ flex: 1 }} />
                  <SmallButton
                    label={t("cards.otp_verify")}
                    loading={saving}
                    disabled={otpCode.length !== 6}
                    onPress={verifyOtp}
                    style={{ flex: 1 }}
                  />
                </View>
                <SmallButton label={t("cards.otp_resend")} variant="outline" onPress={requestOtp} />
              </GlassSurface>
            )
          ) : (
            <SmallButton label={t("cards.add")} icon={Plus} onPress={() => setFormOpen(true)} />
          )}

          {/* To'lovlar tarixi */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Receipt size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t("cards.history")}</Text>
          </View>
          {payments.length === 0 ? (
            <EmptyState icon={Receipt} title={t("cards.history_empty")} desc={t("cards.history_empty_desc")} />
          ) : (
            <View style={{ gap: 10 }}>
              {payments.map((p) => {
                const badge = statusBadge(p.status);
                return (
                  <Card key={p.id} style={styles.payRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.payAmount} numberOfLines={1}>
                        +{formatSom(p.amount)} {t("cards.som")}
                        <Text style={styles.payMethod}>
                          {"  "}· {p.method === "payme" ? "Payme" : p.method === "click" ? "Click" : p.method}
                        </Text>
                      </Text>
                      <Text style={styles.payMeta} numberOfLines={1}>
                        {p.client_name ? `${p.client_name} · ` : ""}
                        {t("cards.booking_for")} {shortDate(p.booking_date)}
                        {p.start_time ? ` ${p.start_time.slice(0, 5)}` : ""}
                      </Text>
                    </View>
                    <StatusBadge label={badge.label} tone={badge.tone} />
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  cardRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardNumber: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3 },

  form: {
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  formFallback: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.4),
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: colors.onSurface,
  },
  brandHint: { fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: 6 },
  otpSent: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 19 },
  devCode: { fontSize: 13, fontWeight: "700", color: colors.secondary, lineHeight: 19 },
  otpInput: { fontSize: 20, fontWeight: "700", textAlign: "center", letterSpacing: 8 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  payRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  payAmount: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  payMethod: { fontSize: 12, fontWeight: "500", color: colors.onSurfaceVariant },
  payMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3 },
}));
