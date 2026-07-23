// Sozlamalar — web'dagi sidebar funksiyalari: til, biznes profil, chiqish.
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, Globe, LogOut, Moon, MonitorSmartphone, Store, Sun } from "lucide-react-native";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { Card, ClientAvatar, GlassIconButton, GlassSurface } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors, useTheme, type ThemeMode } from "@/context/ThemeContext";
import { useProvider } from "@/context/ProviderContext";
import { localize } from "@/utils/localize";

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { provider } = useProvider();
  const { t, lang, setLang } = useLanguage();
  const { mode, setMode } = useTheme();

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
    { value: "dark", label: t("pv.theme_dark"), icon: Moon },
    { value: "light", label: t("pv.theme_light"), icon: Sun },
    { value: "system", label: t("pv.theme_system"), icon: MonitorSmartphone },
  ];

  const businessName = localize(provider?.business_name, lang) || provider?.slug || "";

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.logout"), style: "destructive", onPress: logout },
    ]);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <Text style={styles.title}>{t("pv.portal")}</Text>
      </View>

      {/* Foydalanuvchi */}
      <Card style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ClientAvatar name={user?.name || null} avatarUrl={user?.avatar} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user?.email}
          </Text>
          {businessName ? (
            <Text style={styles.userBusiness} numberOfLines={1}>
              {businessName}
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Til */}
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Globe size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>{t("pv.lang")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["uz", "ru"] as const).map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={{ flex: 1 }}>
              <GlassSurface
                style={styles.langPill}
                fallbackStyle={[
                  styles.langPillFallback,
                  lang === l
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                ]}
                tintColor={lang === l ? colors.primary : undefined}
                interactive
              >
                <Text
                  style={[
                    styles.langText,
                    { color: lang === l ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}
                >
                  {l === "uz" ? "O'zbekcha" : "Русский"}
                </Text>
              </GlassSurface>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Tema */}
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Moon size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>{t("pv.theme")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = mode === value;
            return (
              <Pressable key={value} onPress={() => setMode(value)} style={{ flex: 1 }}>
                <GlassSurface
                  style={[styles.langPill, { flexDirection: "row", justifyContent: "center", gap: 6 }]}
                  fallbackStyle={[
                    styles.langPillFallback,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                  ]}
                  tintColor={active ? colors.primary : undefined}
                  interactive
                >
                  <Icon size={14} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                  <Text
                    style={[
                      styles.langText,
                      { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                    ]}
                  >
                    {label}
                  </Text>
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Biznes profil */}
      <Pressable onPress={() => router.push("/business-profile")}>
        <Card style={styles.menuRow}>
          <View style={styles.menuIcon}>
            <Store size={18} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>
            {provider ? t("ab.edit_title") : t("tt.create_business")}
          </Text>
          <ChevronRight size={18} color={colors.onSurfaceVariant} />
        </Card>
      </Pressable>

      {/* Chiqish */}
      <Pressable onPress={handleLogout}>
        <Card style={[styles.menuRow, { borderColor: alpha(colors.errorContainer, 0.5) }]}>
          <View style={[styles.menuIcon, { backgroundColor: alpha(colors.errorContainer, 0.25) }]}>
            <LogOut size={18} color={colors.error} />
          </View>
          <Text style={[styles.menuText, { color: colors.error }]}>{t("auth.logout")}</Text>
        </Card>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },

  userName: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  userEmail: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  userBusiness: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  langPill: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
    overflow: "hidden",
  },
  langPillFallback: { borderWidth: 1 },
  langText: { fontSize: 13, fontWeight: "700" },

  menuRow: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primaryContainer, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.onSurface },
}));
