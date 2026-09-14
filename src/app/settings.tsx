// Sozlamalar — hisob, biznes va ilova sozlamalari.
// Tuzilish: profil sarlavhasi → guruhlangan ro'yxatlar (ingichka ajratgichlar bilan):
//   Biznes (profil, tarif, QR) · Ilova (til, tema) · Hisob (chiqish, o'chirish).
// QR kod ro'yxatda joy egallamaydi — qatorni bosganda pastdan oyna bo'lib ochiladi.
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Crown,
  Globe,
  LogOut,
  MonitorSmartphone,
  Moon,
  QrCode,
  Share2,
  Sun,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/pv/screen";
import { Card, ClientAvatar, GlassIconButton, SmallButton } from "@/components/pv/ui";
import { alpha, radius, type Tone } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors, useTheme, useToneColors, type ThemeMode } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { planStatusSubtitle } from "@/utils/plan";

// ── Guruh ichidagi bitta qator ──
function Row({
  icon: Icon,
  tone = "primary",
  title,
  titleColor,
  subtitle,
  badge,
  right,
  onPress,
  disabled,
  first,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  titleColor?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  /** O'ng tomondagi element; berilmasa bosiladigan qatorda strelka chiziladi */
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Guruhdagi birinchi qator — ustida ajratgich chizilmaydi */
  first?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const c = useToneColors()[tone];

  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: alpha(colors.onSurface, 0.05) }]}>
      {!first ? <View style={styles.divider} /> : null}
      <View style={[styles.rowIcon, { backgroundColor: alpha(c.container, 0.16) }]}>
        <Icon size={17} color={c.text} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, titleColor ? { color: titleColor } : null]} numberOfLines={1}>
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? right : onPress ? <ChevronRight size={16} color={colors.outline} /> : null}
    </View>
  );

  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} disabled={disabled} style={disabled ? { opacity: 0.6 } : null}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

// ── Ixcham segmented tanlagich (til, tema) ──
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label?: string; icon?: LucideIcon; a11y: string }[];
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.segTrack}>
      {options.map((o) => {
        const active = o.value === value;
        const fg = active ? colors.primary : colors.onSurfaceVariant;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.a11y}
            hitSlop={4}
            style={[styles.segItem, !o.label && styles.segItemIconOnly, active && styles.segItemActive]}
          >
            {o.icon ? <o.icon size={15} color={fg} strokeWidth={active ? 2.4 : 2} /> : null}
            {o.label ? (
              <Text style={[styles.segText, { color: fg }, active && styles.segTextActive]}>{o.label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { provider } = useProvider();
  const { isStaff } = useStaffRoleContext();
  const { t, lang, setLang } = useLanguage();
  const { mode, setMode } = useTheme();
  const [qrOpen, setQrOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const themeOptions: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
    { value: "dark", label: t("pv.theme_dark"), icon: Moon },
    { value: "light", label: t("pv.theme_light"), icon: Sun },
    { value: "system", label: t("pv.theme_system"), icon: MonitorSmartphone },
  ];
  const activeTheme = themeOptions.find((o) => o.value === mode);

  const businessName = localize(provider?.business_name, lang) || provider?.slug || "";
  const isTrial = provider?.subscription_status === "trial";
  const version = Constants.expoConfig?.version;

  // QR ichidagi link — universal https havola: ilova o'rnatilmagan mijozda ham
  // brauzerda provayder sahifasi (vaqtda.uz/[slug]) ochilib, bron qila oladi.
  // Dev'da esa exp:// link: kamera skaner qilsa Expo Go ochilib mijoz
  // ilovasiga kirib ketadi (Metro shu kompyuterda 8081-portda turishi kerak).
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  const qrUrl = provider?.slug
    ? __DEV__ && devHost
      ? `exp://${devHost}:8081/--/provider/${provider.slug}`
      : `https://vaqtda.uz/${provider.slug}`
    : null;

  const handleShareQr = async () => {
    if (!qrUrl) return;
    try {
      await Share.share({ message: qrUrl });
    } catch {
      // foydalanuvchi bekor qildi
    }
  };

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.logout"), style: "destructive", onPress: logout },
    ]);
  };

  // Hisobni butunlay o'chirish — server (delete-account) shaxsiy ma'lumotlarni
  // tozalaydi va akkauntni yopadi, so'ng ilovadan chiqamiz
  const handleDeleteAccount = () => {
    Alert.alert(t("acc.delete_title"), t("acc.delete_confirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("acc.delete_btn"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          const { error } = await supabase.functions.invoke("delete-account", { body: {} });
          setDeleting(false);
          if (error) {
            Alert.alert(t("acc.delete_failed"));
            return;
          }
          await logout();
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <Text style={styles.title}>{t("pv.more_settings")}</Text>
      </View>

      {/* Profil */}
      <View style={styles.profile}>
        <ClientAvatar name={user?.name || null} avatarUrl={user?.avatar} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user?.email}
          </Text>
          {businessName ? (
            <View style={styles.bizChip}>
              <Building2 size={11} color={colors.primary} />
              <Text style={styles.bizChipText} numberOfLines={1}>
                {businessName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Biznes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("set.section_business")}</Text>
        <Card>
          {/* Ega tahrirlaydi, klinika xodimi esa faqat ko'radi */}
          <Row
            first
            icon={Building2}
            title={isStaff ? t("biz.view_title") : provider ? t("ab.edit_title") : t("tt.create_business")}
            onPress={() => router.push("/business-profile")}
          />
          {/* Tarif — faqat biznes egasi uchun */}
          {!isStaff ? (
            <Row
              icon={Crown}
              tone="tertiary"
              title={t("pv.more_plan")}
              badge={
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: alpha(isTrial ? colors.tertiaryContainer : colors.primaryContainer, 0.2) },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: isTrial ? colors.tertiary : colors.primary }]}>
                    {isTrial ? t("plan.badge_trial") : (provider?.plan_code || "pro").toUpperCase()}
                  </Text>
                </View>
              }
              subtitle={planStatusSubtitle(provider, t)}
              onPress={() => router.push("/plan")}
            />
          ) : null}
          {qrUrl ? (
            <Row
              icon={QrCode}
              title={t("pv.qr_title")}
              subtitle={t("set.qr_row_sub")}
              onPress={() => setQrOpen(true)}
            />
          ) : null}
        </Card>
      </View>

      {/* Ilova */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("set.section_app")}</Text>
        <Card>
          <Row
            first
            icon={Globe}
            title={t("pv.lang")}
            right={
              <Segmented
                value={lang}
                onChange={setLang}
                options={[
                  { value: "uz", label: "O'zbekcha", a11y: "O'zbekcha" },
                  { value: "ru", label: "Русский", a11y: "Русский" },
                ]}
              />
            }
          />
          <Row
            icon={Moon}
            title={t("pv.theme")}
            subtitle={activeTheme?.label}
            right={
              <Segmented
                value={mode}
                onChange={(v) => setMode(v)}
                options={themeOptions.map((o) => ({ value: o.value, icon: o.icon, a11y: o.label }))}
              />
            }
          />
        </Card>
      </View>

      {/* Hisob */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t("set.section_account")}</Text>
        <Card>
          <Row first icon={LogOut} tone="error" title={t("auth.logout")} right={null} onPress={handleLogout} />
          {/* Hisobni o'chirish — App Store talabi (Guideline 5.1.1(v)) */}
          <Row
            icon={Trash2}
            tone="error"
            title={t("acc.delete")}
            titleColor={colors.error}
            subtitle={t("acc.delete_sub")}
            right={deleting ? <ActivityIndicator size="small" color={colors.error} /> : null}
            onPress={handleDeleteAccount}
            disabled={deleting}
          />
        </Card>
      </View>

      {version ? <Text style={styles.footer}>Vaqtda Provider · {t("set.version", { v: version })}</Text> : null}

      {/* QR kod oynasi — mijoz skaner qilib Vaqtda sahifasida bron qiladi */}
      {qrUrl ? (
        <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setQrOpen(false)}>
            <Pressable
              style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t("pv.qr_title")}</Text>
                <Pressable onPress={() => setQrOpen(false)} hitSlop={10} style={styles.sheetClose}>
                  <X size={16} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
              {/* Oq plastina — tungi temada ham skaner o'qiy olishi uchun */}
              <View style={styles.qrPlate}>
                <QRCode value={qrUrl} size={196} backgroundColor="#ffffff" color="#0c1310" />
              </View>
              {provider?.slug ? <Text style={styles.qrLink}>vaqtda.uz/{provider.slug}</Text> : null}
              <Text style={styles.qrSub}>{t("pv.qr_sub")}</Text>
              <SmallButton
                label={t("pv.qr_share")}
                icon={Share2}
                onPress={handleShareQr}
                style={{ alignSelf: "stretch" }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { fontSize: 20, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.3 },

    profile: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 },
    userName: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
    userEmail: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
    bizChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      maxWidth: "100%",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: alpha(colors.primary, 0.12),
    },
    bizChipText: { fontSize: 11, fontWeight: "700", color: colors.primary, flexShrink: 1 },

    section: { gap: 8 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 4,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 58,
    },
    // Ingichka ajratgich ikonkadan keyin boshlanadi (iOS guruhlangan ro'yxat uslubi)
    divider: {
      position: "absolute",
      top: 0,
      left: 58,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface, flexShrink: 1 },
    rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

    badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
    badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },

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
      paddingHorizontal: 10,
      borderRadius: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    segItemIconOnly: { width: 36, paddingHorizontal: 0 },
    segItemActive: { backgroundColor: alpha(colors.primary, 0.16) },
    segText: { fontSize: 13, fontWeight: "600" },
    segTextActive: { fontWeight: "700" },

    footer: { textAlign: "center", fontSize: 11, color: colors.outline, marginTop: 4 },

    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surfaceContainerHigh,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 14,
      alignItems: "center",
    },
    sheetHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: alpha(colors.onSurfaceVariant, 0.35),
    },
    sheetHeader: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
    sheetTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.onSurface },
    sheetClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(colors.onSurface, 0.08),
    },
    qrPlate: { padding: 14, borderRadius: radius.lg, backgroundColor: "#ffffff" },
    qrLink: { fontSize: 14, fontWeight: "700", color: colors.primary },
    qrSub: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      textAlign: "center",
      lineHeight: 17,
      paddingHorizontal: 8,
    },
  })
);
