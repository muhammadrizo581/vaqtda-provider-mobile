// Provayder paneli uchun kirish va ro'yxatdan o'tish — saytdagi app/login/page.tsx dan port.
import { Image } from "expo-image";
import { Lock, Mail, Phone, Store, User } from "lucide-react-native";
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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { GlassSurface, liquidGlass } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors, useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register";

// Bounce'siz, tez so'nuvchi easing — barcha o'tishlar shu bilan
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

// ── Glass segmented — Telegram header'idagi kabi: bitta glass kapsula,
// ichida oq-shaffof tanlov pill'i sirpanadi (bounce'siz).
function GlassSegmented({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  // padding: 3 ikki tomondan — thumb faqat kontent qismida yuradi
  const thumbW = (width - 6) / options.length;

  const thumbStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: withTiming(idx * thumbW, { duration: 220, easing: ease }) }],
    }),
    [idx, thumbW]
  );

  // Telegram/iOS segmented ko'rinishi: tanlov neytral oq (dark'da oq-shaffof)
  const thumbColor = scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)";

  return (
    <GlassSurface style={[styles.segWrap, style]} fallbackStyle={styles.segFallback} interactive>
      <View style={styles.segInner} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View
            style={[styles.segThumb, { width: thumbW, backgroundColor: thumbColor }, thumbStyle]}
          />
        )}
        {options.map((o) => (
          <Pressable key={o.key} style={styles.segBtn} onPress={() => onChange(o.key)}>
            <Text style={[styles.segText, value === o.key && styles.segTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </GlassSurface>
  );
}

export default function LoginScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { login } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Register maydonlari doim mounted turadi — balandligi o'lchanib, bounce'siz
  // timing bilan 0 ↔ to'liq oraliqda ochib-yopiladi.
  const [fieldsH, setFieldsH] = useState(0);
  const reg = useDerivedValue(
    () => withTiming(mode === "register" ? 1 : 0, { duration: 300, easing: ease }),
    [mode]
  );
  const fieldsStyle = useAnimatedStyle(() => ({
    height: reg.value * fieldsH,
    opacity: reg.value * reg.value, // matn oxirroqda paydo bo'ladi
    // Yopiq holatda karta gap'ining bittasini yutib yuboradi (16 + 0 + 16 → 16)
    marginBottom: 16 * (reg.value - 1),
  }));

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleLogin = async () => {
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

  const handleRegister = async () => {
    if (!fullName.trim() || !businessName.trim() || !email.trim() || !password) return;
    setError(null);
    if (password.length < 6) {
      setError(t("auth.password_short"));
      return;
    }
    setPending(true);
    try {
      const res = await supabase.functions.invoke("provider-register", {
        body: {
          full_name: fullName.trim(),
          phone: phone ? `+998${phone}` : "",
          business_name: businessName.trim(),
          email: email.trim(),
          password,
        },
      });
      if (res.error) {
        // Xato kodi javob tanasida keladi ({error:"email_taken"} kabi)
        let code = "";
        try {
          const body = await (res.error as { context?: Response }).context?.json();
          code = body?.error || "";
        } catch {}
        setError(
          code === "email_taken"
            ? t("auth.email_taken")
            : code === "password_short"
              ? t("auth.password_short")
              : t("auth.register_error")
        );
        setPending(false);
        return;
      }
      // Akkaunt tayyor — darhol kiramiz, guard panelga o'tkazadi.
      const loginRes = await login(email.trim(), password);
      if (loginRes.error) {
        setError(t("auth.login_error"));
        setPending(false);
      }
    } catch {
      setError(t("auth.register_error"));
      setPending(false);
    }
  };

  const handleSubmit = mode === "login" ? handleLogin : handleRegister;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}
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
          <Text style={styles.subtitle}>
            {mode === "login" ? t("auth.login_subtitle") : t("auth.register_subtitle_pv")}
          </Text>
        </View>

        {/* Rejim almashtirgich — Telegram header'idagi kabi glass kapsula */}
        <GlassSegmented
          options={[
            { key: "login", label: t("auth.login") },
            { key: "register", label: t("auth.signup") },
          ]}
          value={mode}
          onChange={(m) => switchMode(m as Mode)}
          style={styles.modeSeg}
        />

        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Register maydonlari — balandligi bounce'siz ochilib-yopiladi */}
          <Animated.View style={[styles.fieldsClip, fieldsStyle]}>
            <View
              style={styles.fieldsContent}
              onLayout={(e) => setFieldsH(e.nativeEvent.layout.height)}
            >
              <View style={styles.inputWrap}>
                <User size={16} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t("auth.full_name")}
                  placeholderTextColor={colors.outline}
                  autoComplete="name"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputWrap}>
                <Store size={16} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder={t("auth.business_name")}
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
              </View>
              <View style={styles.inputWrap}>
                <Phone size={16} color={colors.onSurfaceVariant} style={styles.inputIcon} />
                <Text style={styles.phonePrefix}>+998</Text>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 9))}
                  placeholder="90 123 45 67"
                  placeholderTextColor={colors.outline}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  style={[styles.input, styles.phoneInput]}
                />
              </View>
            </View>
          </Animated.View>

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
            style={({ pressed }) => ({ opacity: pending ? 0.7 : pressed ? 0.9 : 1 })}
          >
            <GlassSurface
              style={styles.submitBtn}
              fallbackStyle={{ backgroundColor: colors.primary }}
              tintColor={colors.primary}
              interactive
            >
              {pending ? (
                <AnimatedLogo variant="loading" size={20} background={null} foreground={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "login" ? t("auth.login") : t("auth.create_account")}
                </Text>
              )}
            </GlassSurface>
          </Pressable>
        </GlassSurface>

        {/* Til almashtirish — xuddi shu glass kapsula, ixcham */}
        <View style={styles.langRow}>
          <GlassSegmented
            options={[
              { key: "uz", label: "UZ" },
              { key: "ru", label: "RU" },
            ]}
            value={lang}
            onChange={(l) => setLang(l as "uz" | "ru")}
            style={styles.langSeg}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  logoBox: {
    height: 80,
    width: 80,
    borderRadius: radius.xxxl,
    overflow: "hidden",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },

  // ── Glass segmented (Telegram uslubi) ──
  segWrap: {
    borderRadius: 999,
    overflow: "hidden",
  },
  segFallback: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  segInner: {
    flexDirection: "row",
    position: "relative",
    padding: 3,
  },
  segThumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  segTextActive: { color: colors.onSurface, fontWeight: "700" },
  modeSeg: { marginBottom: 16 },
  langSeg: { width: 140 },

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
  fieldsClip: { overflow: "hidden" },
  fieldsContent: { position: "absolute", top: 0, left: 0, right: 0, gap: 16 },
  inputWrap: { position: "relative", justifyContent: "center" },
  inputIcon: { position: "absolute", left: 16, zIndex: 1 },
  phonePrefix: {
    position: "absolute",
    left: 44,
    zIndex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
  phoneInput: { paddingLeft: 88 },
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
    borderRadius: radius.xl,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  submitText: { color: colors.onPrimary, fontWeight: "800", fontSize: 14 },

  langRow: { alignItems: "center", marginTop: 24 },
}));
