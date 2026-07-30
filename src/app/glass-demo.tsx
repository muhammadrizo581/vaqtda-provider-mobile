// Liquid Glass demo — expo-glass-effect imkoniyatlarini jonli ko'rish uchun vaqtinchalik ekran.
// Ochish: exp://<host>:8081/--/glass-demo
import { GlassContainer, GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLOCKS = [
  { bg: "#ff6b6b", label: "Bronlar" },
  { bg: "#ffd93d", label: "Navbat" },
  { bg: "#6bcb77", label: "Jadval" },
  { bg: "#4d96ff", label: "Xizmatlar" },
  { bg: "#b06bff", label: "Statistika" },
  { bg: "#ff9f43", label: "Sozlamalar" },
];

export default function GlassDemoScreen() {
  const insets = useSafeAreaInsets();
  const available = isLiquidGlassAvailable();

  return (
    <View style={styles.root}>
      {/* Orqa fon — glass ostida harakatlanadigan rangli kontent */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 120, paddingBottom: 160 }}>
        {BLOCKS.map((b) => (
          <View key={b.label} style={[styles.block, { backgroundColor: b.bg }]}>
            <Text style={styles.blockText}>{b.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Tepada: regular glass panel */}
      <GlassView
        style={[styles.header, { top: insets.top + 8 }]}
        glassEffectStyle="regular"
      >
        <Text style={styles.headerText}>
          Liquid Glass {available ? "mavjud ✓" : "mavjud emas ✗"}
        </Text>
      </GlassView>

      {/* Pastda: GlassContainer — yaqin elementlar bir-biriga qo'shilib oqadi */}
      <GlassContainer spacing={24} style={[styles.dock, { bottom: insets.bottom + 24 }]}>
        <GlassView style={styles.circle} isInteractive />
        <GlassView style={styles.circle} isInteractive />
        <GlassView style={[styles.circle, styles.tinted]} tintColor="#4d96ff" isInteractive />
        <GlassView style={styles.pill} glassEffectStyle="clear" isInteractive>
          <Text style={styles.pillText}>clear</Text>
        </GlassView>
      </GlassContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1310" },
  block: {
    height: 140,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  blockText: { fontSize: 28, fontWeight: "800", color: "#0c1310" },
  header: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  dock: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  circle: { width: 64, height: 64, borderRadius: 32 },
  tinted: {},
  pill: {
    height: 64,
    paddingHorizontal: 24,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
