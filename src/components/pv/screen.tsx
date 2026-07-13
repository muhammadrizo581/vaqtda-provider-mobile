// Har bir tab ekran uchun umumiy konteyner: xavfsiz maydon + skroll + padding.
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { liquidGlass } from "@/components/pv/ui";
import { colors } from "@/constants/colors";

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.inner,
        {
          paddingTop: insets.top + 12,
          // Liquid Glass tab bar ostidan kontent oqib o'tadi — pastda joy qoldiramiz
          paddingBottom: liquidGlass ? insets.bottom + 96 : 32,
        },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { paddingHorizontal: 16, gap: 16, flexGrow: 1 },
});
