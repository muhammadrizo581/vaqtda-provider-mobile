// Provayder paneli uchun kirish va ro'yxatdan o'tish — saytdagi app/login/page.tsx dan port.
// Eskiz.uz SMS OTP tasdiqlash integratsiyasi bilan.
import { Image } from "expo-image";
import {
  ArrowLeft,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Store,
  User,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
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
import { EskizService, formatPhoneNumber, generateOtp } from "@/services/eskiz";

type Mode = "login" | "register";
type RegisterStep = "form" | "otp";

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

  // ── OTP Tasdiqlash holatlari ──
  const [regStep, setRegStep] = useState<RegisterStep>("form");
  const [sentOtp, setSentOtp] = useState<string>("");
  const [enteredOtp, setEnteredOtp] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const [resending, setResending] = useState<boolean>(false);
  const otpInputRef = useRef<TextInput>(null);

  // Countdown taymeri
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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
    setRegStep("form");
    setEnteredOtp("");
    setSentOtp("");
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

  // 1-bosqich: Register formasini tekshirib, Eskiz orqali SMS OTP yuborish
  const handleInitiateRegister = async () => {
    if (!fullName.trim()) {
      setError(t("auth.full_name"));
      return;
    }
    if (!businessName.trim()) {
      setError(t("auth.business_name"));
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 9) {
      setError(t("auth.phone_invalid"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError(t("auth.email_placeholder"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.password_short"));
      return;
    }

    setError(null);
    setPending(true);

    try {
      // 4 xonali OTP kod generatsiya qilamiz (shablon: Vaqtda ilovasi orqali ro'yxatdan o'tish uchun tasdiqlash kodi: {CODE}...)
      const generatedCode = generateOtp(4);
      const fullPhoneNumber = `998${cleanPhone}`;

      const smsRes = await EskizService.sendRegistrationOtp(fullPhoneNumber, generatedCode);

      if (!smsRes.success && smsRes.error && !smsRes.id?.startsWith("dev-mock")) {
        setError(t("auth.sms_send_error"));
        setPending(false);
        return;
      }

      setSentOtp(generatedCode);
      setEnteredOtp("");
      setRegStep("otp");
      setCountdown(60);
      setPending(false);

      // Inputga fokus berish
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 300);
    } catch (e) {
      console.error("SMS yuborishda xato:", e);
      setError(t("auth.sms_send_error"));
      setPending(false);
    }
  };

  // Kodni qayta yuborish (Resend OTP)
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setError(null);
    setResending(true);

    try {
      const generatedCode = generateOtp(4);
      const cleanPhone = phone.replace(/\D/g, "");
      const fullPhoneNumber = `998${cleanPhone}`;

      await EskizService.sendRegistrationOtp(fullPhoneNumber, generatedCode);

      setSentOtp(generatedCode);
      setEnteredOtp("");
      setCountdown(60);
      setResending(false);
    } catch (e) {
      console.error("Kodni qayta yuborishda xato:", e);
      setError(t("auth.sms_send_error"));
      setResending(false);
    }
  };

  // 2-bosqich: OTP kodni tasdiqlash va ro'yxatdan o'tishni yakunlash
  const handleVerifyOtpAndRegister = async () => {
    if (enteredOtp.length !== 4) {
      setError(t("auth.otp_required"));
      return;
    }

    if (enteredOtp !== sentOtp) {
      setError(t("auth.invalid_otp"));
      return;
    }

    setError(null);
    setPending(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await supabase.functions.invoke("provider-register", {
        body: {
          full_name: fullName.trim(),
          phone: `+998${cleanPhone}`,
          business_name: businessName.trim(),
          email: email.trim(),
          password,
        },
      });

      if (res.error) {
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

  const handleSubmit =
    mode === "login"
      ? handleLogin
      : regStep === "form"
        ? handleInitiateRegister
        : handleVerifyOtpAndRegister;

  const displayPhone = phone.length > 0 ? formatPhoneNumber(`998${phone}`) : "";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
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
            {mode === "login"
              ? t("auth.login_subtitle")
              : regStep === "otp"
                ? t("auth.otp_verification")
                : t("auth.register_subtitle_pv")}
          </Text>
        </View>

        {/* Rejim almashtirgich — faqat OTP bosqichida bo'lmaganda ko'rinadi */}
        {regStep === "form" && (
          <GlassSegmented
            options={[
              { key: "login", label: t("auth.login") },
              { key: "register", label: t("auth.signup") },
            ]}
            value={mode}
            onChange={(m) => switchMode(m as Mode)}
            style={styles.modeSeg}
          />
        )}

        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ═══════════ REJIM 1: LOGIN YOKI REGISTER FORMA ═══════════ */}
          {regStep === "form" ? (
            <>
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
                  placeholder={mode === "login" ? t("auth.email_or_username") : t("auth.email_placeholder")}
                  placeholderTextColor={colors.outline}
                  autoCapitalize="none"
                  autoComplete={mode === "login" ? "username" : "email"}
                  keyboardType={mode === "login" ? "default" : "email-address"}
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
                    <AnimatedLogo
                      variant="loading"
                      size={20}
                      background={null}
                      foreground={colors.onPrimary}
                    />
                  ) : (
                    <Text style={styles.submitText}>
                      {mode === "login" ? t("auth.login") : t("auth.create_account")}
                    </Text>
                  )}
                </GlassSurface>
              </Pressable>
            </>
          ) : (
            /* ═══════════ REJIM 2: OTP TASDIQLASH BOSQICHI ═══════════ */
            <View style={styles.otpStepContainer}>
              {/* Orqaga qaytish tugmasi */}
              <Pressable
                style={styles.backRow}
                onPress={() => {
                  setRegStep("form");
                  setError(null);
                }}
              >
                <ArrowLeft size={16} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>
                  {t("auth.change_phone")}
                </Text>
              </Pressable>

              <View style={styles.otpHeader}>
                <View
                  style={[
                    styles.otpIconBadge,
                    { backgroundColor: alpha(colors.primary, 0.12) },
                  ]}
                >
                  <ShieldCheck size={28} color={colors.primary} />
                </View>
                <Text style={styles.otpTitle}>{t("auth.otp_verification")}</Text>
                <Text style={styles.otpSubtitle}>
                  {t("auth.otp_sent_to", { phone: displayPhone })}
                </Text>
              </View>

              {/* Yashirin TextInput & 4 ta vizual katakcha */}
              <View style={styles.otpBoxWrapper}>
                <TextInput
                  ref={otpInputRef}
                  value={enteredOtp}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, "").slice(0, 4);
                    setEnteredOtp(clean);
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.hiddenOtpInput}
                  autoFocus
                />
                <Pressable
                  style={styles.otpDigitsRow}
                  onPress={() => otpInputRef.current?.focus()}
                >
                  {[0, 1, 2, 3].map((index) => {
                    const digit = enteredOtp[index] || "";
                    const isFocused = enteredOtp.length === index;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.otpDigitBox,
                          {
                            backgroundColor: liquidGlass
                              ? alpha(colors.surfaceContainerLow, 0.55)
                              : colors.surfaceContainerLow,
                            borderColor: isFocused
                              ? colors.primary
                              : digit
                                ? alpha(colors.primary, 0.5)
                                : colors.outlineVariant,
                            borderWidth: isFocused ? 2 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.otpDigitText, { color: colors.onSurface }]}>
                          {digit}
                        </Text>
                      </View>
                    );
                  })}
                </Pressable>
              </View>

              {/* Kodni qayta yuborish qatori */}
              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={styles.resendTimerText}>
                    {t("auth.resend_code_in", { seconds: countdown })}
                  </Text>
                ) : (
                  <Pressable
                    onPress={handleResendOtp}
                    disabled={resending}
                    style={styles.resendBtn}
                  >
                    <RotateCcw size={14} color={colors.primary} />
                    <Text style={[styles.resendBtnText, { color: colors.primary }]}>
                      {resending ? t("auth.sending_sms") : t("auth.resend_code")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Tasdiqlash tugmasi */}
              <Pressable
                onPress={handleSubmit}
                disabled={pending || enteredOtp.length !== 4}
                style={({ pressed }) => ({
                  opacity: pending || enteredOtp.length !== 4 ? 0.6 : pressed ? 0.9 : 1,
                })}
              >
                <GlassSurface
                  style={styles.submitBtn}
                  fallbackStyle={{ backgroundColor: colors.primary }}
                  tintColor={colors.primary}
                  interactive
                >
                  {pending ? (
                    <AnimatedLogo
                      variant="loading"
                      size={20}
                      background={null}
                      foreground={colors.onPrimary}
                    />
                  ) : (
                    <Text style={styles.submitText}>{t("auth.verify_and_register")}</Text>
                  )}
                </GlassSurface>
              </Pressable>
            </View>
          )}
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

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
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
    subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4, textAlign: "center" },

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
      backgroundColor: liquidGlass
        ? alpha(colors.surfaceContainerLow, 0.55)
        : colors.surfaceContainerLow,
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

    // ── OTP Bosqichi Stili ──
    otpStepContainer: {
      gap: 16,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingVertical: 4,
    },
    backText: {
      fontSize: 13,
      fontWeight: "600",
    },
    otpHeader: {
      alignItems: "center",
      marginVertical: 4,
    },
    otpIconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    otpTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.onSurface,
      marginBottom: 4,
    },
    otpSubtitle: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: "center",
      lineHeight: 18,
      paddingHorizontal: 8,
    },
    otpBoxWrapper: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 6,
    },
    hiddenOtpInput: {
      position: "absolute",
      width: "100%",
      height: "100%",
      opacity: 0,
      zIndex: 2,
    },
    otpDigitsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
      width: "100%",
    },
    otpDigitBox: {
      width: 54,
      height: 58,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    otpDigitText: {
      fontSize: 24,
      fontWeight: "700",
    },
    resendRow: {
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 2,
    },
    resendTimerText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
    },
    resendBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    resendBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },

    langRow: { alignItems: "center", marginTop: 24 },
  })
);
