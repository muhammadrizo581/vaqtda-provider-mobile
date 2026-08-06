// "Boshqa" — tizimning UIKit "More" ekrani o'rniga o'zimizning shisha menyu.
// Jadval, Xizmatlar/Stollar/Kompyuterlar, Statistika, Biznes profil, Sozlamalar.
//
// Xodim (usta/shifokor) uchun ro'yxat qisqaradi: o'z jadvali, o'z xizmatlari,
// o'z statistikasi, biznes profili (faqat ko'rish), sozlamalar va chiqish.
// Biznes boshqaruvi (bo'limlar, ustalar/shifokorlar, kartalar, to'lov) ko'rsatilmaydi.
import { useRouter, type Href } from "expo-router";
import {
  Armchair,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LogIn,
  LogOut,
  Monitor,
  Settings,
  Stethoscope,
  Store,
  Tag,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { ClientAvatar, GlassSurface, PageHeader } from "@/components/pv/ui";
import { alpha, radius, type Tone } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { makeThemedStyles, useColors, useToneColors } from "@/context/ThemeContext";
import { useBookingMode } from "@/hooks/useBookingMode";
import { localize } from "@/utils/localize";

interface MoreItem {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: Href;
  tone: Tone;
}

export default function MoreScreen() {
  const colors = useColors();
  const tones = useToneColors();
  const styles = useStyles();
  const { t, lang } = useLanguage();
  const { mode, unit, usesDepartments, usesStaff } = useBookingMode();
  const { user, isAuthenticated, logout } = useAuth();
  const { isStaff, staffName } = useStaffRoleContext();
  const { provider } = useProvider();
  const router = useRouter();

  const clinicName = localize(provider?.business_name, lang) || provider?.slug || "";

  // Klinika jadval rejimi: "shared" — jadval butun biznesga umumiy (uni faqat
  // rahbar tuzadi), aks holda har bir xodim o'z jadvalini o'zi tuzadi.
  // Ustun hali qo'shilmagan bo'lsa — eski xatti-harakat (har kimga alohida).
  const sharedSchedule = usesStaff && provider?.schedule_mode === "shared";

  // Xodim boshqaruvi bitta bo'lim, lekin biznes turiga qarab nomi/ekrani boshqa:
  //   bo'limli biznes (shifoxona/klinika) → /staff  (Shifokorlar)
  //   bo'limsiz biznes (sartaroshxona…)   → /workers (Ustalar)
  const isClinic = usesStaff && usesDepartments;
  const showStaffScreen = usesStaff && isClinic;
  const showWorkersScreen = usesStaff && !isClinic;

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.logout"), style: "destructive", onPress: logout },
    ]);
  };

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

  // Biznes egasi uchun to'liq ro'yxat
  const ownerItems: MoreItem[] = [
    {
      key: "profile",
      icon: Store,
      title: t("pv.more_profile"),
      subtitle: t("pv.more_profile_sub"),
      href: "/business-profile" as Href,
      tone: "primary",
    },
    {
      key: "schedule",
      icon: CalendarDays,
      title: t("pv.nav_schedule"),
      // "Har kimga alohida" rejimida rahbar jadvalni faqat ko'radi
      subtitle:
        usesStaff && !sharedSchedule ? t("sch.more_individual_sub") : t("pv.more_schedule_sub"),
      href: "/schedule" as Href,
      tone: "primary",
    },
    // Shifoxona/klinika: bo'limlar — faqat kategoriya bayroqchasi yoqilganda
    ...(usesDepartments
      ? [
          {
            key: "departments",
            icon: Building2,
            title: t("dep.nav"),
            subtitle: t("dep.more_sub"),
            href: "/departments" as Href,
            tone: "primary" as Tone,
          },
        ]
      : []),
    // Shifoxona/klinika: shifokorlar
    ...(showStaffScreen
      ? [
          {
            key: "staff",
            icon: Stethoscope,
            title: t("stf.nav"),
            subtitle: t("stf.more_sub"),
            href: "/staff" as Href,
            tone: "tertiary" as Tone,
          },
        ]
      : []),
    {
      key: "services",
      icon: ServicesIcon,
      title: servicesTitle,
      subtitle: servicesSub,
      href: "/services" as Href,
      tone: "secondary",
    },
    // Ustalar (sartaroshxona kabi bizneslar): usta qo'shish + login yaratish
    ...(showWorkersScreen
      ? [
          {
            key: "workers",
            icon: Users,
            title: t("pv.nav_workers"),
            subtitle: t("pv.more_workers_sub"),
            href: "/workers" as Href,
            tone: "tertiary" as Tone,
          },
        ]
      : []),
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
      key: "cards",
      icon: CreditCard,
      title: t("pv.more_cards"),
      subtitle: t("pv.more_cards_sub"),
      href: "/cards" as Href,
      tone: "primary",
    },
    {
      key: "paycfg",
      icon: Wallet,
      title: t("pv.more_paycfg"),
      subtitle: t("pv.more_paycfg_sub"),
      href: "/payment-settings" as Href,
      tone: "secondary",
    },
    {
      key: "stats",
      icon: BarChart3,
      title: t("stats.title"),
      subtitle: t("pv.more_stats_sub"),
      href: "/stats" as Href,
      tone: "tertiary",
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

  // Xodim uchun — o'ziga tegishli to'liq panel: o'z jadvali (umumiy rejimda
  // biznes jadvali — faqat ko'rish), o'z xizmatlari, o'z statistikasi
  // (faqat uning bronlari), biznes profili (faqat ko'rish).
  const staffItems: MoreItem[] = [
    {
      key: "schedule",
      icon: CalendarDays,
      title: sharedSchedule ? t("sch.business_title") : t("stf.my_schedule"),
      subtitle: sharedSchedule ? t("sch.more_shared_sub") : t("stf.my_schedule_sub"),
      href: "/schedule" as Href,
      tone: "primary",
    },
    // Xizmatlarni xodim o'zi qo'shadi (services.worker_id)
    {
      key: "services",
      icon: Tag,
      title: t("svc.my_title"),
      subtitle: t("pv.more_services_sub"),
      href: "/services" as Href,
      tone: "secondary",
    },
    {
      key: "stats",
      icon: BarChart3,
      title: t("stf.my_stats"),
      subtitle: t("stf.my_stats_sub"),
      href: "/stats" as Href,
      tone: "tertiary",
    },
    {
      key: "profile",
      icon: Store,
      title: t("pv.more_profile"),
      subtitle: t("biz.readonly_sub"),
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

  const items = isStaff ? staffItems : ownerItems;

  return (
    <Screen>
      <PageHeader title={t("pv.nav_more")} />

      {/* Profil: kirgan bo'lsa — hisob kartasi, bo'lmasa — Kirish */}
      {isAuthenticated ? (
        <Pressable onPress={() => router.push("/settings")}>
          {({ pressed }) => (
            <GlassSurface
              style={[styles.accountGlass, pressed && { opacity: 0.85 }]}
              fallbackStyle={styles.rowFallback}
              interactive
            >
              <ClientAvatar name={user?.name || null} avatarUrl={user?.avatar} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {(isStaff ? staffName : null) || user?.name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {user?.email}
                </Text>
                {/* Xodim qaysi biznesda ishlashini ko'rib tursin */}
                {isStaff && clinicName ? (
                  <Text style={styles.rowClinic} numberOfLines={1}>
                    {t("stf.staff_at", { name: clinicName })}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={18} color={colors.outline} />
            </GlassSurface>
          )}
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push("/login")}>
          {({ pressed }) => (
            <GlassSurface
              style={[styles.accountGlass, pressed && { opacity: 0.85 }]}
              fallbackStyle={styles.rowFallback}
              interactive
            >
              <View style={[styles.rowIcon, { backgroundColor: alpha(colors.primaryContainer, 0.2) }]}>
                <LogIn size={19} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t("auth.login")}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {t("pv.login_sub")}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.outline} />
            </GlassSurface>
          )}
        </Pressable>
      )}

      <View style={styles.list}>
        {items.map((item) => {
          const c = tones[item.tone];
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

        {/* Chiqish — xodimda Sozlamalardan tashqari shu yerda ham turadi,
            chunki uning menyusi qisqa va biznes bo'limlari yo'q */}
        {isStaff ? (
          <Pressable onPress={handleLogout}>
            {({ pressed }) => (
              <GlassSurface
                style={[styles.rowGlass, pressed && { opacity: 0.85 }]}
                fallbackStyle={styles.rowFallback}
                interactive
              >
                <View style={[styles.rowIcon, { backgroundColor: alpha(colors.errorContainer, 0.2) }]}>
                  <LogOut size={19} color={colors.error} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, { color: colors.error }]} numberOfLines={1}>
                    {t("auth.logout")}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {t("stf.logout_sub")}
                  </Text>
                </View>
              </GlassSurface>
            )}
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 10 },
  accountGlass: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
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
  rowClinic: { fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: 2 },
}));
