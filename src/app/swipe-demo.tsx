// Instagram uslubidagi interaktiv swipe navigatsiyasining to'liq ishlaydigan misoli.
// 3 sahifa: Feed / Reels / Messages.
//   • Header ostidagi chiziq barmoq bilan REAL VAQTDA suriladi (live progress).
//   • Pastki bar sahifa TINGANDA yangilanadi; teginish ham pager'ni suradi.
// Ochish uchun: router.push("/swipe-demo").
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { SwipePager, type SwipePagerRef } from "@/components/pv/swipe-pager";
import { useColors } from "@/context/ThemeContext";

const PAGES = [
  { key: "feed", title: "Feed", icon: "home" as const },
  { key: "reels", title: "Reels", icon: "movie" as const },
  { key: "messages", title: "Messages", icon: "send" as const },
];

export default function SwipeDemo() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const pagerRef = React.useRef<SwipePagerRef>(null);
  const progress = useSharedValue(0); // 0..2, barmoq bilan birga
  const [index, setIndex] = React.useState(0); // faqat sahifa tINGANDA

  const segW = width / PAGES.length;

  // Header ostidagi chiziq — progress bilan uzluksiz suriladi (UI thread).
  const underline = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: progress.value * segW }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header: 3 yorliq + live chiziq ── */}
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          {PAGES.map((p, i) => (
            <Pressable key={p.key} style={styles.headerTab} onPress={() => pagerRef.current?.goTo(i)}>
              <Text
                style={[
                  styles.headerText,
                  { color: index === i ? colors.onSurface : colors.onSurfaceVariant },
                ]}
              >
                {p.title}
              </Text>
            </Pressable>
          ))}
        </View>
        <Animated.View style={[styles.underline, underline, { backgroundColor: colors.primary }]} />
      </View>

      {/* ── Interaktiv pager ── */}
      <SwipePager ref={pagerRef} progress={progress} onIndexChange={setIndex}>
        <FeedPage />
        <ReelsPage />
        <MessagesPage />
      </SwipePager>

      {/* ── Pastki bar: sahifa tINGANDA yangilanadi ── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surfaceContainer, paddingBottom: insets.bottom + 8 }]}>
        {PAGES.map((p, i) => {
          const active = index === i;
          return (
            <Pressable key={p.key} style={styles.bottomItem} onPress={() => pagerRef.current?.goTo(i)}>
              <MaterialIcons
                name={p.icon}
                size={26}
                color={active ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={[styles.bottomLabel, { color: active ? colors.primary : colors.onSurfaceVariant }]}>
                {p.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Modulli sahifalar (real ilovada alohida fayllarga chiqariladi) ──

function Page({ label, hint }: { label: string; hint: string }) {
  const colors = useColors();
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Text style={[styles.pageTitle, { color: colors.onSurface }]}>{label}</Text>
      <Text style={[styles.pageHint, { color: colors.onSurfaceVariant }]}>{hint}</Text>
    </View>
  );
}

function FeedPage() {
  return <Page label="📰 Feed" hint="Chapga suring — Reels" />;
}
function ReelsPage() {
  return <Page label="🎬 Reels" hint="Ikki tomonga suring" />;
}
function MessagesPage() {
  return <Page label="✉️ Messages" hint="O'ngga suring — Reels" />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row" },
  headerTab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  headerText: { fontSize: 16, fontWeight: "700" },
  underline: { height: 2.5, borderRadius: 2 },
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  pageTitle: { fontSize: 30, fontWeight: "800" },
  pageHint: { fontSize: 15 },
  bottomBar: { flexDirection: "row", paddingTop: 10 },
  bottomItem: { flex: 1, alignItems: "center", gap: 3 },
  bottomLabel: { fontSize: 11, fontWeight: "600" },
});
