// Klinikaga qo'shilish — shifokor egadan olgan 8 belgili taklif kodini kiritadi.
// RPC: redeem_staff_invite(p_code) → {ok:true, provider_id, staff_id} yoki
// {ok:false, error:"invalid"|"used"|"expired"|"already_staff"|"unauthorized"}.
// Muvaffaqiyatda rol qayta yuklanadi (provider profili ham unga ergashadi) va
// panelning cheklangan ko'rinishi ochiladi.
import { useRouter } from "expo-router";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react-native";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import { Card, GlassIconButton, GlassSurface, SmallButton } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

const CODE_LEN = 8;

export default function JoinClinicScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { reload: reloadRole } = useStaffRoleContext();

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Faqat harf/raqam, doim BOSH HARF, 8 belgigacha (kod alifbosi: 2-9, A-Z)
  const onChange = (v: string) => {
    setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN));
    setError(null);
  };

  const submit = async () => {
    if (code.length !== CODE_LEN) {
      setError(t("inv.err_len"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("redeem_staff_invite", { p_code: code });
      // Migratsiya hali qo'llanmagan bo'lsa — funksiya umuman yo'q
      if (rpcErr) {
        setError(t("inv.unavailable"));
        return;
      }
      const res = (data || {}) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(
          res.error === "invalid"
            ? t("inv.err_invalid")
            : res.error === "used"
              ? t("inv.err_used")
              : res.error === "expired"
                ? t("inv.err_expired")
                : res.error === "already_staff"
                  ? t("inv.err_already_staff")
                  : res.error === "unauthorized"
                    ? t("inv.err_unauthorized")
                    : t("inv.err_failed")
        );
        return;
      }
      // Rol yangilanadi → provider profili ham avtomatik klinikaga almashadi
      // (useProviderProfile rolga bog'langan; bu yerda qo'lda yuklash shart emas
      // va u eski holat bilan ishlab, ekranni bir zumga "biznes yo'q" qilardi)
      await reloadRole();
      showToast(t("inv.joined"));
      router.replace("/(tabs)");
    } catch {
      setError(t("inv.err_failed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <View style={styles.headerRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>{t("inv.join_title")}</Text>
            <Text style={styles.subtitle}>{t("inv.join_sub")}</Text>
          </View>
        </View>

        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <KeyRound size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>{t("inv.code_label")}</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            value={code}
            onChangeText={onChange}
            placeholder={t("inv.code_ph")}
            placeholderTextColor={colors.outline}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LEN}
            style={styles.codeInput}
            onSubmitEditing={submit}
          />

          <Text style={styles.hint}>{t("inv.join_hint")}</Text>

          <SmallButton
            label={t("inv.submit")}
            icon={LogIn}
            onPress={submit}
            loading={pending}
            disabled={code.length !== CODE_LEN}
          />
        </GlassSurface>

        {/* Kirgan hisob — noto'g'ri akkaunt bilan kirib qolgan bo'lsa chiqadi */}
        <Card style={styles.accountCard}>
          <Text style={styles.accountText} numberOfLines={1}>
            {t("tt.logged_in_as")} {user?.email}
          </Text>
          <Text style={styles.logoutText} onPress={logout}>
            {t("auth.logout")}
          </Text>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },

  card: {
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  cardFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },

  errorBox: {
    padding: 12,
    backgroundColor: alpha(colors.errorContainer, 0.2),
    borderWidth: 1,
    borderColor: alpha(colors.errorContainer, 0.4),
    borderRadius: radius.lg,
  },
  errorText: { color: colors.error, fontSize: 12, fontWeight: "600", textAlign: "center" },

  codeInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
    color: colors.onSurface,
  },
  hint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },

  accountCard: { padding: 16, alignItems: "center", gap: 6 },
  accountText: { fontSize: 12, color: colors.onSurfaceVariant },
  logoutText: { fontSize: 12, fontWeight: "700", color: colors.error },
}));
