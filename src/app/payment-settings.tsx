// To'lov sozlamalari — provayder bron uchun to'lov rejimini tanlaydi:
//   none            — to'lovsiz bron (joyida to'lanadi)
//   percent / fixed — oldindan qisman to'lov: foiz (10–50%) YOKI aniq summa (so'mda)
//   full            — 100% oldindan to'lov
// providers.prepayment_type / prepayment_percent / prepayment_amount ustunlariga
// saqlanadi — mijoz ilovasi bron paytida aynan shu qiymatlardan summani hisoblaydi.
import { useRouter } from "expo-router";
import { ArrowLeft, Banknote, Percent, Wallet, type LucideIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import { Card, GlassIconButton, SelectPill, SmallButton, Spinner } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { formatSom } from "@/utils/price";

// Ekrandagi 3 karta: partial (foiz yoki aniq summa), none, full
type Mode = "partial" | "none" | "full";
// Partial ichida birlik tanlovi — valyuta tanlagichga o'xshash % / so'm
type PartialUnit = "percent" | "som";

const PERCENT_MIN = 10;
const PERCENT_MAX = 50;
const PERCENT_PRESETS = [10, 20, 30, 40, 50];
const AMOUNT_MIN = 1000; // so'm
const AMOUNT_PRESETS = [10000, 20000, 50000, 100000];

export default function PaymentSettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { provider, loading, reload } = useProvider();

  const [mode, setMode] = useState<Mode>("none");
  const [unit, setUnit] = useState<PartialUnit>("percent");
  const [percentText, setPercentText] = useState("30");
  const [amountDigits, setAmountDigits] = useState("10000");
  const [saving, setSaving] = useState(false);

  // Joriy sozlamani formaga yuklaymiz
  useEffect(() => {
    if (!provider) return;
    const type = provider.prepayment_type || "none";
    setMode(type === "percent" || type === "fixed" ? "partial" : type);
    setUnit(type === "fixed" ? "som" : "percent");
    const p = Number(provider.prepayment_percent) || 30;
    setPercentText(String(Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, p))));
    const a = Number(provider.prepayment_amount) || 10000;
    setAmountDigits(String(Math.max(AMOUNT_MIN, Math.round(a))));
  }, [provider]);

  const options: { value: Mode; icon: LucideIcon; title: string; desc: string }[] = [
    { value: "partial", icon: Percent, title: t("paycfg.mode_percent"), desc: t("paycfg.mode_percent_desc") },
    { value: "none", icon: Banknote, title: t("paycfg.mode_none"), desc: t("paycfg.mode_none_desc") },
    { value: "full", icon: Wallet, title: t("paycfg.mode_full"), desc: t("paycfg.mode_full_desc") },
  ];

  const save = async () => {
    if (!provider) return;
    let type: "none" | "percent" | "fixed" | "full" = mode === "partial" ? "percent" : mode;
    let percent = 0;
    let amount = 0;
    if (mode === "partial" && unit === "percent") {
      percent = Number(percentText);
      if (!Number.isFinite(percent) || percent < PERCENT_MIN || percent > PERCENT_MAX) {
        showToast(t("paycfg.percent_invalid"), "error");
        return;
      }
    }
    if (mode === "partial" && unit === "som") {
      type = "fixed";
      amount = Number(amountDigits);
      if (!Number.isFinite(amount) || amount < AMOUNT_MIN) {
        showToast(t("paycfg.amount_invalid"), "error");
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from("providers")
      .update({ prepayment_type: type, prepayment_percent: percent, prepayment_amount: amount })
      .eq("id", provider.id);
    setSaving(false);
    if (error) {
      showToast(t("paycfg.save_failed"), "error");
      return;
    }
    showToast(t("paycfg.saved"));
    reload();
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("paycfg.title")}</Text>
          <Text style={styles.subtitle}>{t("paycfg.sub")}</Text>
        </View>
      </View>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <View style={{ gap: 10 }}>
            {options.map((o) => {
              const active = mode === o.value;
              return (
                <Pressable key={o.value} onPress={() => setMode(o.value)}>
                  <Card
                    style={[
                      styles.optionRow,
                      active && { borderColor: colors.primary, borderWidth: 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        { backgroundColor: alpha(active ? colors.primaryContainer : colors.surfaceContainerHighest, active ? 0.2 : 1) },
                      ]}
                    >
                      <o.icon size={19} color={active ? colors.primary : colors.onSurfaceVariant} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.optionTitle}>{o.title}</Text>
                      <Text style={styles.optionDesc}>{o.desc}</Text>
                    </View>
                    {/* Radio belgisi */}
                    <View style={[styles.radio, { borderColor: active ? colors.primary : colors.outlineVariant }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          {/* Qisman to'lov: birlik tanlash (% yoki so'm) + qiymat */}
          {mode === "partial" && (
            <Card style={{ padding: 20, gap: 14 }}>
              {/* Birlik almashtirgich — % / so'm */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["percent", "som"] as const).map((u) => (
                  <SelectPill
                    key={u}
                    label={u === "percent" ? t("paycfg.unit_percent") : t("paycfg.unit_som")}
                    active={unit === u}
                    onPress={() => setUnit(u)}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>

              {unit === "percent" ? (
                <>
                  <Text style={styles.label}>{t("paycfg.percent_label")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TextInput
                      value={percentText}
                      onChangeText={(v) => setPercentText(v.replace(/[^\d]/g, "").slice(0, 3))}
                      keyboardType="numeric"
                      placeholder="30"
                      placeholderTextColor={colors.outline}
                      style={[styles.input, { width: 90, textAlign: "center" }]}
                    />
                    <Text style={styles.suffix}>%</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {PERCENT_PRESETS.map((p) => (
                      <SelectPill
                        key={p}
                        label={`${p}%`}
                        active={Number(percentText) === p}
                        onPress={() => setPercentText(String(p))}
                      />
                    ))}
                  </View>
                  <Text style={styles.hint}>{t("paycfg.percent_hint")}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>{t("paycfg.amount_label")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TextInput
                      value={formatSom(amountDigits)}
                      onChangeText={(v) => setAmountDigits(v.replace(/[^\d]/g, "").slice(0, 9))}
                      keyboardType="numeric"
                      placeholder="10 000"
                      placeholderTextColor={colors.outline}
                      style={[styles.input, { flex: 1, textAlign: "center" }]}
                    />
                    <Text style={styles.suffix}>{t("paycfg.unit_som")}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {AMOUNT_PRESETS.map((a) => (
                      <SelectPill
                        key={a}
                        label={formatSom(a)}
                        active={Number(amountDigits) === a}
                        onPress={() => setAmountDigits(String(a))}
                      />
                    ))}
                  </View>
                  <Text style={styles.hint}>{t("paycfg.amount_hint")}</Text>
                </>
              )}
            </Card>
          )}

          <SmallButton label={t("common.save")} loading={saving} onPress={save} />
        </>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  optionRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  optionDesc: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3, lineHeight: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },

  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
  },
  suffix: { fontSize: 16, fontWeight: "700", color: colors.onSurfaceVariant },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
}));
