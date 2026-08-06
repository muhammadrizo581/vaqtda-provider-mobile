// Biznes profili bo'lmasa ekranni yopadigan darvoza (web'dagi BusinessGate).
// Mobil ilovada yaratish oqimi bor — tugma /business-profile ga olib boradi.
// Klinika XODIMI (shifokor) uchun darvoza ochiq: uning biznesi yo'q, lekin
// klinikaga bog'langan — panelning cheklangan qismini ko'radi.
// Pastda kirgan hisob ko'rsatiladi va chiqish mumkin — foydalanuvchi eski sessiya
// bilan "login qilmaganman" deb adashmasligi uchun.
import { useRouter } from "expo-router";
import { KeyRound, Store } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { EmptyState, SmallButton, Spinner } from "./ui";

export function BusinessGate({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const colors = useColors();
  const { provider, loading } = useProvider();
  const { isStaff, loading: roleLoading } = useStaffRoleContext();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  if (loading || roleLoading) return <Spinner style={{ flex: 1 }} />;

  // Shifokor o'z biznesini yaratmaydi — klinika unga taklif kodi orqali bog'langan
  if (isStaff) return <>{children}</>;

  if (!provider) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState icon={Store} title={t("tt.no_business_title")} desc={t("tt.no_business_desc")} />
        <View style={{ alignItems: "center", gap: 14 }}>
          <SmallButton
            label={t("tt.create_business")}
            onPress={() => router.push("/business-profile")}
          />
          {/* Ikkilamchi yo'l: klinikada ishlaydigan shifokor kod bilan kiradi */}
          <Pressable onPress={() => router.push("/join-clinic")} hitSlop={8}>
            <View style={styles.joinRow}>
              <KeyRound size={13} color={colors.primary} />
              <Text style={styles.joinText}>{t("inv.gate_link")}</Text>
            </View>
          </Pressable>
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
  joinRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  joinText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
  accountRow: {
    marginTop: 24,
    alignItems: "center",
    gap: 4,
  },
  accountText: { fontSize: 12, color: colors.onSurfaceVariant },
  logoutText: { fontSize: 12, fontWeight: "700", color: colors.error },
}));
