// Panelning kichik umumiy UI bo'laklari — saytdagi components/pv/ui.tsx dan port.
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { AnimatedLogo } from "@/components/animated-logo";
import { alpha, colors, radius, toneColors, type BadgeTone, type Tone } from "@/constants/colors";

// iOS 26+ Liquid Glass mavjudmi — bo'lmasa (Android, eski iOS) eski tekis ko'rinish qoladi.
export const liquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

// ── Liquid Glass yuzasi (fallback bilan) ──
// style — layout (radius/padding), fallbackStyle — glass bo'lmaganda fon/chegara.
export function GlassSurface({
  children,
  style,
  fallbackStyle,
  tintColor,
  interactive,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  interactive?: boolean;
}) {
  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tintColor}
        isInteractive={interactive}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[style, fallbackStyle]}>{children}</View>;
}

// ── Statistika kartasi ──
export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const c = toneColors[tone];
  return (
    <GlassSurface
      style={styles.statCardGlass}
      fallbackStyle={styles.statCardFallback}
      tintColor={alpha(c.container, 0.14)}
    >
      <View style={styles.statCardTop}>
        <Text style={styles.statCardLabel} numberOfLines={2}>
          {label}
        </Text>
        <View style={[styles.statCardIcon, { backgroundColor: alpha(c.container, 0.2) }]}>
          <Icon size={16} color={c.text} />
        </View>
      </View>
      <View style={styles.statCardValueRow}>
        <Text style={styles.statCardValue}>{value}</Text>
        {suffix ? <Text style={styles.statCardSuffix}>{suffix}</Text> : null}
      </View>
    </GlassSurface>
  );
}

// ── Holat belgisi (badge) ──
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const bg =
    tone === "muted" ? colors.surfaceVariant : alpha(toneColors[tone].container, 0.2);
  const border =
    tone === "muted" ? colors.outlineVariant : alpha(toneColors[tone].container, 0.3);
  const text = tone === "muted" ? colors.onSurfaceVariant : toneColors[tone].text;
  const dot = tone === "muted" ? colors.outline : toneColors[tone].text;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.badgeDot, { backgroundColor: dot }]} />
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

// ── Sahifa sarlavhasi ──
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

// ── Mijoz avatari (bosh harflar bilan) ──
export function ClientAvatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string | null;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alpha(colors.primaryContainer, 0.2),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
}

// ── Bo'sh holat ──
export function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={20} color={colors.onSurfaceVariant} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {desc ? <Text style={styles.emptyDesc}>{desc}</Text> : null}
    </View>
  );
}

// ── Yuklanish indikatori — aylanma logo (artifactdagi "loading" varianti) ──
export function Spinner({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }, style]}>
      <AnimatedLogo variant="loading" size={64} background={null} />
    </View>
  );
}

// ── Dumaloq shisha ikon-tugma (orqaga, sozlamalar va h.k.) ──
export function GlassIconButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface
      style={[styles.iconBtnGlass, style]}
      fallbackStyle={styles.iconBtnFallback}
      interactive
    >
      <Pressable style={styles.iconBtnInner} onPress={onPress}>
        {children}
      </Pressable>
    </GlassSurface>
  );
}

// ── Filtr pili ──
export function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  if (liquidGlass) {
    return (
      <Pressable onPress={onPress}>
        <GlassView
          glassEffectStyle="regular"
          colorScheme="dark"
          isInteractive
          tintColor={active ? colors.primary : undefined}
          style={styles.pillGlass}
        >
          <Text
            style={[styles.pillText, { color: active ? colors.onPrimary : colors.onSurface }]}
          >
            {label}
          </Text>
        </GlassView>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
      ]}
    >
      <Text
        style={[styles.pillText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Kichik tugma (asosiy / ikkilamchi) ──
export function SmallButton({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "error";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === "primary" ? colors.primary : variant === "error" ? alpha(colors.errorContainer, 0.35) : colors.surface;
  const fg =
    variant === "primary" ? colors.onPrimary : variant === "error" ? colors.error : colors.onSurfaceVariant;
  const borderColor = variant === "outline" ? colors.outlineVariant : "transparent";
  if (liquidGlass) {
    const tint =
      variant === "primary"
        ? colors.primary
        : variant === "error"
          ? alpha(colors.errorContainer, 0.55)
          : undefined;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        // Diqqat: opacity hech qachon 0 bo'lmasin — aks holda glass effekt chizilmaydi
        style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
      >
        <GlassView
          glassEffectStyle="regular"
          colorScheme="dark"
          isInteractive
          tintColor={tint}
          style={styles.smallBtnGlass}
        >
          {loading ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <>
              {Icon ? <Icon size={14} color={fg} /> : null}
              <Text style={[styles.smallBtnText, { color: fg }]} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
        </GlassView>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.smallBtn,
        { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={14} color={fg} /> : null}
          <Text style={[styles.smallBtnText, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ── Yoqish/o'chirish (switch) ──
// iOS'da tizim UISwitch ishlatiladi — iOS 26 da u avtomatik Liquid Glass ko'rinishga ega.
// Android/webda web'dagi 11×6 track dizayni qoladi.
export function TogglePill({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  if (Platform.OS === "ios") {
    return (
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.primary, false: colors.surfaceContainerHighest }}
        style={styles.nativeSwitch}
      />
    );
  }
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.toggleTrack,
        { backgroundColor: value ? colors.primary : colors.surfaceContainerHighest },
      ]}
    >
      <View
        style={[
          styles.toggleKnob,
          { alignSelf: value ? "flex-end" : "flex-start", backgroundColor: value ? colors.onPrimary : colors.outline },
        ]}
      />
    </Pressable>
  );
}

// ── Karta (umumiy konteyner) ──
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" style={[styles.cardGlass, style]}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: colors.surfaceContainer,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flex: 1,
  },
  statCardGlass: {
    padding: 12,
    borderRadius: radius.xl,
    flex: 1,
    overflow: "hidden",
  },
  statCardFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  statCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 16,
  },
  statCardIcon: { padding: 6, borderRadius: radius.md },
  statCardValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  statCardValue: { fontSize: 24, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },
  statCardSuffix: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
  },
  pageTitle: { fontSize: 24, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: colors.onSurfaceVariant, marginTop: 4 },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: {
    height: 48,
    width: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  emptyDesc: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4, textAlign: "center", maxWidth: 320 },

  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillGlass: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillText: { fontSize: 13, fontWeight: "600" },

  iconBtnGlass: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  iconBtnFallback: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  iconBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  smallBtnGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  smallBtnText: { fontSize: 12, fontWeight: "600" },

  // UISwitch (51×31) ni pill (44×24) o'lchamiga yaqinlashtirish
  nativeSwitch: {
    transform: [{ scale: 0.8 }],
    marginVertical: -4,
    marginHorizontal: -5,
  },

  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 999,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: { width: 18, height: 18, borderRadius: 9 },

  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: "hidden",
  },
  cardGlass: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
});
