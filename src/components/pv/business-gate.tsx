// Biznes profili bo'lmasa ekranni yopadigan darvoza (web'dagi BusinessGate).
// Mobil ilovada yaratish oqimi bor — tugma /business-profile ga olib boradi.
import { useRouter } from "expo-router";
import { Store } from "lucide-react-native";
import React from "react";
import { View } from "react-native";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { EmptyState, SmallButton, Spinner } from "./ui";

export function BusinessGate({ children }: { children: React.ReactNode }) {
  const { provider, loading } = useProvider();
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
      </View>
    );
  }

  return <>{children}</>;
}
