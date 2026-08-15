// SettleModal — bandlik yopilayotganda mijoz to'liq to'lamagan bo'lsa chiqadi.
// Qolgan summani ko'rsatadi va 2 variant: Naqd (darhol yopadi) yoki Click orqali
// (QR — mijoz skanerlaydi, to'lov webhook orqali tasdiqlangach bandlik yopiladi).
import { ArrowLeft, Banknote, CheckCircle2, QrCode, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SmallButton } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { buildClickCheckoutUrl, CLICK_ENABLED, remainderParam } from "@/utils/click";
import { formatSom } from "@/utils/price";

type Step = "choose" | "qr";

export function SettleModal({
  visible,
  onClose,
  bookingId,
  total,
  paid,
  clientName,
  onCash,
  onOnlinePaid,
}: {
  visible: boolean;
  onClose: () => void;
  bookingId: string | null;
  total: number;
  paid: number;
  clientName?: string | null;
  onCash: () => Promise<void> | void;
  onOnlinePaid: () => Promise<void> | void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remaining = Math.max(0, total - paid);

  // Ochilganda bosqichni qayta tiklaymiz
  useEffect(() => {
    if (visible) setStep("choose");
  }, [visible]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // QR bosqichida — remainder to'lov 'paid' bo'lganini kutamiz (webhook flip qiladi)
  useEffect(() => {
    if (step !== "qr" || !bookingId) return;
    let done = false;
    const check = async () => {
      const { data } = await supabase
        .from("payments")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("kind", "remainder")
        .eq("status", "paid")
        .limit(1);
      if (!done && data && data.length > 0) {
        done = true;
        stopPoll();
        setBusy(true);
        await onOnlinePaid();
        setBusy(false);
      }
    };
    pollRef.current = setInterval(check, 3000);
    check();
    return stopPoll;
  }, [step, bookingId, onOnlinePaid, stopPoll]);

  const handleClose = () => {
    if (busy) return;
    stopPoll();
    onClose();
  };

  const handleCash = async () => {
    setBusy(true);
    await onCash();
    setBusy(false);
  };

  const checkoutUrl =
    bookingId && CLICK_ENABLED ? buildClickCheckoutUrl(remainderParam(bookingId), remaining) : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {step === "choose" ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t("settle.title")}</Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <X size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <Text style={styles.desc}>
                {clientName ? `${clientName} · ` : ""}
                {t("settle.desc")}
              </Text>

              {/* Summalar */}
              <View style={styles.amounts}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>{t("settle.total")}</Text>
                  <Text style={styles.amountValue}>{formatSom(total)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>{t("settle.paid_already")}</Text>
                  <Text style={[styles.amountValue, { color: colors.secondary }]}>
                    {paid > 0 ? `−${formatSom(paid)}` : formatSom(0)}
                  </Text>
                </View>
                <View style={[styles.amountRow, styles.remainRow]}>
                  <Text style={styles.remainLabel}>{t("settle.remaining")}</Text>
                  <Text style={styles.remainValue}>{formatSom(remaining)}</Text>
                </View>
              </View>

              {/* Naqd */}
              <SmallButton label={t("settle.cash")} icon={Banknote} loading={busy} onPress={handleCash} />
              <Text style={styles.hint}>{t("settle.cash_hint")}</Text>

              {/* Online (Click QR) */}
              {CLICK_ENABLED ? (
                <SmallButton
                  label={t("settle.online")}
                  icon={QrCode}
                  variant="outline"
                  disabled={busy}
                  onPress={() => setStep("qr")}
                />
              ) : (
                <View style={styles.soonWrap}>
                  <SmallButton label={t("settle.online")} icon={QrCode} variant="outline" disabled onPress={() => {}} />
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonText}>{t("settle.soon")}</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Pressable onPress={() => !busy && setStep("choose")} hitSlop={8}>
                  <ArrowLeft size={18} color={colors.onSurfaceVariant} />
                </Pressable>
                <Text style={styles.title}>{t("settle.qr_title")}</Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <X size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <Text style={styles.desc}>{t("settle.qr_desc")}</Text>

              {/* QR kod — mijoz skanerlaydi */}
              <View style={styles.qrBox}>
                {checkoutUrl ? <QRCode value={checkoutUrl} size={200} /> : null}
              </View>

              <View style={styles.qrAmountRow}>
                <Text style={styles.remainLabel}>{t("settle.remaining")}</Text>
                <Text style={styles.remainValue}>{formatSom(remaining)}</Text>
              </View>

              {/* To'lovni kutish indikatori */}
              <View style={styles.waitRow}>
                {busy ? (
                  <CheckCircle2 size={16} color={colors.primary} />
                ) : (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
                <Text style={styles.waitText}>{busy ? t("settle.paid_ok") : t("settle.waiting")}</Text>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: alpha("#000000", 0.5),
      justifyContent: "center",
      padding: 20,
    },
    card: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      padding: 20,
      gap: 14,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, flex: 1 },
    desc: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 19 },

    amounts: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: radius.md,
      padding: 14,
      gap: 8,
    },
    amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    amountLabel: { fontSize: 13, color: colors.onSurfaceVariant },
    amountValue: { fontSize: 14, fontWeight: "600", color: colors.onSurface, fontVariant: ["tabular-nums"] },
    remainRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
    remainLabel: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
    remainValue: { fontSize: 18, fontWeight: "800", color: colors.primary, fontVariant: ["tabular-nums"] },

    hint: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: -6 },

    soonWrap: { position: "relative" },
    soonBadge: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: [{ translateY: -9 }],
      backgroundColor: alpha(colors.secondaryContainer, 0.9),
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    soonText: { fontSize: 10, fontWeight: "700", color: colors.secondary },

    // QR bosqichi
    qrBox: {
      alignSelf: "center",
      backgroundColor: "#ffffff",
      padding: 16,
      borderRadius: radius.md,
    },
    qrAmountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: radius.md,
      padding: 14,
    },
    waitRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    waitText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  })
);
