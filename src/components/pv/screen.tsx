// Har bir tab ekran uchun umumiy konteyner: xavfsiz maydon + skroll + padding.
// Pull-to-refresh: mijoz ilovasi (vaqtda-mobile) bilan bir xil — native spinner
// butunlay yashiriladi (iOS'da opacity: 0), o'rnida Vaqtda barglari chiqadi:
// iOS'da Apple uslubida tepadagi tortilgan bo'shliq ichida, Android'da kontent
// tepasida fade + scale bilan. Hammasi VaqtdaRefreshControl/VaqtdaRefreshing ichida.
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { liquidGlass } from "@/components/pv/ui";
import { VaqtdaLoading, VaqtdaRefreshControl, VaqtdaRefreshing } from "@/components/vaqtda-logo";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}
        style={styles.root}
        contentContainerStyle={[
          styles.inner,
          {
            paddingTop: insets.top + 12,
            // Liquid Glass tab bar ostidan kontent oqib o'tadi — pastda joy qoldiramiz
            paddingBottom: liquidGlass ? insets.bottom + 96 : 32,
          },
        ]}
        // iOS: native RefreshControl UMUMAN ishlatilmaydi — uning spinneri turli
        // iOS versiyalarida baribir ko'rinib qolib, ikkita loading bo'lib ketardi.
        // Tortib qo'yib yuborilganda o'zimiz aniqlaymiz; indikator — pastdagi overlay.
        // Android'da bounce yo'q, shuning uchun native RefreshControl qoladi
        // (spinneri shaffof, ko'rinadigani faqat VaqtdaRefreshing).
        refreshControl={
          !isIOS && onRefresh ? (
            <VaqtdaRefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        onScrollEndDrag={
          isIOS && onRefresh
            ? (e) => {
                if (!refreshing && e.nativeEvent.contentOffset.y < -70) onRefresh();
              }
            : undefined
        }
      >
        {!isIOS && onRefresh ? (
          <VaqtdaRefreshing refreshing={!!refreshing} color={colors.primary} />
        ) : null}
        {children}
      </ScrollView>
      {isIOS && onRefresh && refreshing ? (
        <View pointerEvents="none" style={[styles.iosRefresh, { top: insets.top + 8 }]}>
          <VaqtdaLoading size={30} color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: 16, gap: 16, flexGrow: 1 },
    iosRefresh: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 10 },
  })
);
