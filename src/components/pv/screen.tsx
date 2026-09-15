// Har bir tab ekran uchun umumiy konteyner: xavfsiz maydon + skroll + padding.
// Pull-to-refresh: ikki platformada ham native RefreshControl (brend rangida).
// Indikator holatini Screen o'zi boshqaradi — faqat foydalanuvchi tortganda yonadi
// va onRefresh (Promise) tugaguncha ko'rinib turadi; ekranning dastlabki
// yuklanishiga bog'lanmaydi.
// Skroll status bar ostidan boshlanadi — iOS'da native spinner soat/batareya
// ostida yashirinib qolmaydi.
import React, { useCallback, useRef, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { liquidGlass } from "@/components/pv/ui";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

// Juda tez tugagan yangilanishda spinner "miltillab" qolmasligi uchun
const MIN_REFRESH_MS = 600;

export function Screen({
  children,
  onRefresh,
  scroll = true,
}: {
  children: React.ReactNode;
  /** Tortib yangilash; Promise qaytarsa, tugaguncha indikator turadi */
  onRefresh?: () => unknown;
  scroll?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [pulling, setPulling] = useState(false);
  const busy = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || busy.current) return;
    busy.current = true;
    setPulling(true);
    const startedAt = Date.now();
    try {
      await onRefresh();
    } catch {
      // Xatoni ekranning o'zi ko'rsatadi — indikator baribir yopiladi
    } finally {
      const rest = MIN_REFRESH_MS - (Date.now() - startedAt);
      if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
      busy.current = false;
      setPulling(false);
    }
  }, [onRefresh]);

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.root}
        contentContainerStyle={[
          styles.inner,
          {
            paddingTop: 12,
            // Liquid Glass (iOS) va Telegram suzuvchi tab bari (Android) ostidan kontent o'tadi — pastda joy qoldiramiz
            paddingBottom: liquidGlass || Platform.OS === "android" ? insets.bottom + 96 : 32,
          },
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={pulling}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surfaceContainerHigh}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: 16, gap: 16, flexGrow: 1 },
  })
);
