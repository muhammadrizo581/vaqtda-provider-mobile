// Biznes profili bo'lmasa ekranni yopadigan darvoza (web'dagi BusinessGate).
// Mobil ilovada yaratish oqimi bor — tugma /business-profile ga olib boradi.
// Pastda kirgan hisob ko'rsatiladi va chiqish mumkin — foydalanuvchi eski sessiya
// bilan "login qilmaganman" deb adashmasligi uchun.
import { useRouter } from "expo-router";
import { Store } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles } from "@/context/ThemeContext";
import { EmptyState, SmallButton, Spinner } from "./ui";

export function BusinessGate({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { provider, loading } = useProvider();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  if (loading) return <Spinner style={{ flex: 1 }} />;

  if (!provider) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState icon={Store} title={t("tt.no_business_title")} desc={t("tt.no_business_desc")} />
        <View style={{ alignItems: "center" }}>
          <SmallButton
            label={t("tt.create_business")}
            onPress={() => router.push("/business-profile")}
          />
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountText} numberOfLines={1}>
            {t("tt.logged_in_as")} {user?.email}
          </Text>
          <Pressable onPress={logout} hitSlop={8}>
            <Text style={styles.logoutText}>{t("auth.logout")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  accountRow: {
    marginTop: 24,
    alignItems: "center",
    gap: 4,
  },
  accountText: { fontSize: 12, color: colors.onSurfaceVariant },
  logoutText: { fontSize: 12, fontWeight: "700", color: colors.error },
}));
