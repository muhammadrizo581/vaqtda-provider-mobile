import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { TablesManager } from "@/components/pv/tables-manager";
import { GlassIconButton, PageHeader } from "@/components/pv/ui";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/context/ThemeContext";

export default function TablesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();

  return (
    <BusinessGate>
      <Screen>
        <View style={styles.headerRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <View style={{ flex: 1 }}>
            <PageHeader
              title={t("pv.nav_tables_rooms")}
              subtitle={t("pv.more_tables_rooms_sub")}
            />
          </View>
        </View>
        <TablesManager variant="table" />
      </Screen>
    </BusinessGate>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
});
