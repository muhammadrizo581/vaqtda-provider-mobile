// "Boshqa" — tizimning UIKit "More" ekrani o'rniga o'zimizning shisha menyu.
// Jadval, Xizmatlar/Stollar/Kompyuterlar, Statistika, Biznes profil, Sozlamalar.
import { useRouter, type Href } from "expo-router";
import {
  Armchair,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Monitor,
  Settings,
  Store,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { GlassSurface, PageHeader } from "@/components/pv/ui";
import { alpha, colors, radius, toneColors, type Tone } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useBookingMode } from "@/hooks/useBookingMode";

interface MoreItem {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: Href;
  tone: Tone;
}

export default function MoreScreen() {
  const { t } = useLanguage();
  const { mode, unit } = useBookingMode();
  const router = useRouter();

  // table rejimida xizmat tushunchasi yo'q — bo'lim "Stollar" yoki "Kompyuterlar"
  const servicesTitle =
    mode === "table"
      ? unit === "computer"
        ? t("pv.nav_computers")
        : t("pv.nav_tables")
      : t("pv.nav_services");
  const servicesSub =
    mode === "table"
      ? unit === "computer"
        ? t("pv.more_computers_sub")
        : t("pv.more_tables_sub")
      : t("pv.more_services_sub");
  const ServicesIcon = mode === "table" ? (unit === "computer" ? Monitor : Armchair) : Tag;

  const items: MoreItem[] = [
    {
      key: "schedule",
      icon: CalendarDays,
      title: t("pv.nav_schedule"),
      subtitle: t("pv.more_schedule_sub"),
      href: "/schedule" as Href,
      tone: "primary",
    },
    {
      key: "services",
      icon: ServicesIcon,
      title: servicesTitle,
      subtitle: servicesSub,
      href: "/services" as Href,
      tone: "secondary",
    },
    // Restoran (stol rejimi): menyu — mijoz stol bron qilishda oldindan buyurtma qiladi
    ...(mode === "table" && unit === "table"
      ? [
          {
            key: "menu",
            icon: UtensilsCrossed,
            title: t("pv.nav_menu"),
            subtitle: t("pv.more_menu_sub"),
            href: "/menu" as Href,
            tone: "tertiary" as Tone,
          },
        ]
      : []),
    {
      key: "stats",
      icon: BarChart3,
      title: t("stats.title"),
      subtitle: t("pv.more_stats_sub"),
      href: "/stats" as Href,
      tone: "tertiary",
    },
    {
      key: "profile",
      icon: Store,
      title: t("pv.more_profile"),
      subtitle: t("pv.more_profile_sub"),
      href: "/business-profile" as Href,
      tone: "primary",
    },
    {
      key: "settings",
      icon: Settings,
      title: t("pv.more_settings"),
      subtitle: t("pv.more_settings_sub"),
      href: "/settings" as Href,
      tone: "secondary",
    },
  ];

  return (
    <Screen>
      <PageHeader title={t("pv.nav_more")} subtitle={t("pv.more_sub")} />

      <View style={styles.list}>
        {items.map((item) => {
          const c = toneColors[item.tone];
          return (
            <Pressable key={item.key} onPress={() => router.push(item.href)}>
              {({ pressed }) => (
                <GlassSurface
                  style={[styles.rowGlass, pressed && { opacity: 0.85 }]}
                  fallbackStyle={styles.rowFallback}
                  interactive
                >
                  <View style={[styles.rowIcon, { backgroundColor: alpha(c.container, 0.2) }]}>
                    <item.icon size={19} color={c.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.outline} />
                </GlassSurface>
              )}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  rowGlass: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  rowFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
});
