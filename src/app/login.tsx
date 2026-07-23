// Provayder paneli uchun kirish — saytdagi app/login/page.tsx dan port.
import { Image } from "expo-image";
import { Lock, Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { FilterPill, GlassSurface, liquidGlass } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

export default function LoginScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { login, logout, user, isAuthenticated } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Kirgan, lekin provider emas — chiqish taklif qilinadi (web'dagi dashboard guard)
  const notProvider = isAuthenticated && user?.role !== "provider";

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setPending(true);
    const res = await login(email.trim(), password);
    if (res.error) {
      setError(t("auth.login_error"));
      setPending(false);
    }
    // Muvaffaqiyatli bo'lsa AuthContext profilni yuklaydi — guard panelga o'tkazadi.
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>
          <Text style={styles.title}>Vaqtda Provider</Text>
          <Text style={styles.subtitle}>{t("auth.login_subtitle")}</Text>
        </View>

        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          {notProvider ? (
            <>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{t("auth.not_provider")}</Text>
              </View>
              <Pressable style={styles.submitBtn} onPress={logout}>
                <Text style={styles.submitText}>{t("auth.logout")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputWrap}>
                <Mail size={16} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.email_placeholder")}
                  placeholderTextColor={colors.outline}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputWrap}>
                <Lock size={16} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth.password_placeholder")}
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                  autoComplete="password"
                  style={styles.input}
                  onSubmitEditing={handleSubmit}
                />
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={pending}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { opacity: pending ? 0.7 : pressed ? 0.9 : 1 },
                ]}
              >
                {pending ? (
                  <AnimatedLogo variant="loading" size={20} background={null} foreground={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>{t("auth.login")}</Text>
                )}
              </Pressable>
            </>
          )}
        </GlassSurface>

        {/* Til almashtirish */}
        <View style={styles.langRow}>
          {(["uz", "ru"] as const).map((l) => (
            <FilterPill
              key={l}
              label={l.toUpperCase()}
              active={lang === l}
              onPress={() => setLang(l)}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    height: 80,
    width: 80,
    borderRadius: radius.xxxl,
    overflow: "hidden",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },

  card: {
    borderRadius: radius.xxxl,
    padding: 24,
    gap: 16,
    overflow: "hidden",
  },
  cardFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  errorBox: {
    padding: 12,
    backgroundColor: alpha(colors.errorContainer, 0.25),
    borderWidth: 1,
    borderColor: alpha(colors.errorContainer, 0.4),
    borderRadius: radius.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  inputWrap: { position: "relative", justifyContent: "center" },
  inputIcon: { position: "absolute", left: 16, zIndex: 1 },
  input: {
    // Glass karta ichida input orqasidan shisha ko'rinib turadi
    backgroundColor: liquidGlass ? alpha(colors.surfaceContainerLow, 0.55) : colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: liquidGlass ? alpha(colors.outlineVariant, 0.6) : colors.outlineVariant,
    borderRadius: radius.xl,
    paddingLeft: 44,
    paddingRight: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: colors.onPrimary, fontWeight: "800", fontSize: 14 },

  langRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 24 },
}));
