// Har bir tab ekran uchun umumiy konteyner: xavfsiz maydon + skroll + padding.
// Pull-to-refresh: mijoz ilovasi (vaqtda-mobile) bilan bir xil — native spinner
// shaffof qilinadi, o'rnida kontent tepasida VaqtdaRefreshing (Vaqtda barglari,
// fade + scale kirish animatsiyasi bilan) chiqadi.
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { liquidGlass } from "@/components/pv/ui";
import { VaqtdaRefreshControl, VaqtdaRefreshing } from "@/components/vaqtda-logo";
import { makeThemedStyles } from "@/context/ThemeContext";

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
  const styles = useStyles();
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
          <VaqtdaRefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {onRefresh ? <VaqtdaRefreshing refreshing={!!refreshing} /> : null}
      {children}
    </ScrollView>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: 16, gap: 16, flexGrow: 1 },
  })
);
