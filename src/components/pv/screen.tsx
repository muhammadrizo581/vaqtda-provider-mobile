// Har bir tab ekran uchun umumiy konteyner: xavfsiz maydon + skroll + padding.
// Pull-to-refresh: native spinner yashirilgan, o'rnida Vaqtda logo (loading) aylanadi.
import React, { useEffect, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { liquidGlass } from "@/components/pv/ui";
import { makeThemedStyles } from "@/context/ThemeContext";

// Shu masofagacha tortilganda indikator to'liq ko'rinadi (native trigger ~65px)
const PULL_MAX = 72;

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
  const scrollY = useSharedValue(0);
  // pulled — barmoq bilan tortilyapti; pullActive — tortib yuborilgan refresh ketyapti
  const [pulled, setPulled] = useState(false);
  const [pullActive, setPullActive] = useState(false);

  const handleScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Logo faqat kerak bo'lganda mount bo'ladi — cheksiz animatsiya bekor aylanmasin
  useAnimatedReaction(
    () => scrollY.value < -4,
    (cur, prev) => {
      if (cur !== prev) runOnJS(setPulled)(cur);
    }
  );

  // Refresh tugagach overlay'ni yopamiz
  useEffect(() => {
    if (!refreshing) setPullActive(false);
  }, [refreshing]);

  const indicatorStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -scrollY.value) / PULL_MAX);
    return {
      opacity: pullActive ? withTiming(1, { duration: 150 }) : p,
      transform: [{ scale: pullActive ? withTiming(1, { duration: 150 }) : 0.6 + 0.4 * p }],
    };
  }, [pullActive]);

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.root}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
              onRefresh={() => {
                setPullActive(true);
                onRefresh();
              }}
              // Native spinner ko'rinmaydi — o'rnida pastdagi Vaqtda logo overlay
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
            />
          ) : undefined
        }
      >
        {children}
      </Animated.ScrollView>
      {onRefresh && (pulled || pullActive) ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.refreshIndicator, { top: insets.top + 8 }, indicatorStyle]}
        >
          <AnimatedLogo variant="loading" size={36} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: 16, gap: 16, flexGrow: 1 },
    refreshIndicator: { position: "absolute", alignSelf: "center", zIndex: 10 },
  })
);
