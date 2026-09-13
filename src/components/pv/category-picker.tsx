// Kategoriya tanlagich — 5 ta asosiy biznes guruhiga bo'lingan:
// Korporativ (Shifoxona), Kunlik/Sutkalik, Xizmatlar, Restoran/Zal va Avtoservis.
import { Image } from "expo-image";
import {
  Brain,
  Building,
  Building2,
  CalendarDays,
  Camera,
  Car,
  Check,
  ChevronRight,
  Coffee,
  Eye,
  Hand,
  Hotel,
  Key,
  Mic,
  PartyPopper,
  Scissors,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  SunDim,
  Trees,
  Utensils,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GlassSurface } from "@/components/pv/ui";
import { getCategoryImage } from "@/constants/category-images";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { localize } from "@/utils/localize";
import type { TKey } from "@/locales/uz";

export interface CategoryItem {
  id: string;
  name: any;
  slug: string;
  image_url?: string | null;
  booking_mode?: "slots" | "table" | "daily" | string | null;
  uses_departments?: boolean;
  uses_staff?: boolean;
  sort_order?: number;
}

export type CategoryGroupId =
  | "all"
  | "corporate"
  | "daily"
  | "services"
  | "dining"
  | "auto";

export interface CategoryGroupDef {
  id: CategoryGroupId;
  labelKey: TKey;
  icon: LucideIcon;
  color: string;
}

export const CATEGORY_GROUPS: CategoryGroupDef[] = [
  { id: "all", labelKey: "cat_grp.all", icon: Sparkles, color: "#10b981" },
  { id: "corporate", labelKey: "cat_grp.corporate", icon: Building2, color: "#0ea5e9" },
  { id: "daily", labelKey: "cat_grp.daily", icon: CalendarDays, color: "#f59e0b" },
  { id: "services", labelKey: "cat_grp.services", icon: Scissors, color: "#10b981" },
  { id: "dining", labelKey: "cat_grp.dining", icon: Utensils, color: "#f97316" },
  { id: "auto", labelKey: "cat_grp.auto", icon: Car, color: "#06b6d4" },
];

// Har bir kategoriyaning qaysi guruhga tegishliligi
export const CATEGORY_TO_GROUP: Record<string, CategoryGroupId> = {
  // 🏥 Korporativ / Shifoxona va Tibbiyot (bo'limlar, shifokorlar, qabullar)
  klinika: "corporate",
  stomatolog: "corporate",

  // 📅 Kunlik va Sutkalik ijara (kunbay / sutkabay band qilish)
  kvartira: "daily",
  dacha: "daily",
  mehmonxona: "daily",
  "avto-ijara": "daily",

  // 🍽️ Restoran, Ovqatlanish va Zallar (stol / joy band qilish)
  restoran: "dining",
  kafe: "dining",
  karaoke: "dining",
  toyxona: "dining",

  // 🚗 Avto servis va Parvarish
  avtomoyka: "auto",
  avtoservis: "auto",
  detailing: "auto",
  tonirovka: "auto",

  // ✂️ Usta va Individual xizmatlar (vaqt bo'yicha seanslar)
  sartaroshxona: "services",
  "gozallik-saloni": "services",
  tirnoq: "services",
  kosmetolog: "services",
  epilyatsiya: "services",
  "kiprik-qosh": "services",
  fotostudiya: "services",
  psixolog: "services",
};

interface CategoryMeta {
  icon: LucideIcon;
  color: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  sartaroshxona: { icon: Scissors, color: "#10b981" },
  avtomoyka: { icon: Car, color: "#06b6d4" },
  mehmonxona: { icon: Hotel, color: "#f59e0b" },
  stomatolog: { icon: Smile, color: "#0ea5e9" },
  restoran: { icon: Utensils, color: "#f97316" },
  fotostudiya: { icon: Camera, color: "#a855f7" },
  toyxona: { icon: PartyPopper, color: "#ec4899" },
  "gozallik-saloni": { icon: Sparkles, color: "#f43f5e" },
  kvartira: { icon: Building, color: "#6366f1" },
  klinika: { icon: Stethoscope, color: "#14b8a6" },
  kafe: { icon: Coffee, color: "#d97706" },
  karaoke: { icon: Mic, color: "#8b5cf6" },
  tirnoq: { icon: Hand, color: "#d946ef" },
  dacha: { icon: Trees, color: "#22c55e" },
  detailing: { icon: ShieldCheck, color: "#3b82f6" },
  psixolog: { icon: Brain, color: "#14b8a6" },
  "avto-ijara": { icon: Key, color: "#ea580c" },
  tonirovka: { icon: SunDim, color: "#64748b" },
  kosmetolog: { icon: Sparkles, color: "#fb7185" },
  epilyatsiya: { icon: Zap, color: "#eab308" },
  avtoservis: { icon: Wrench, color: "#ef4444" },
  "kiprik-qosh": { icon: Eye, color: "#c084fc" },
};

function getCategoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] || { icon: Sparkles, color: "#10b981" };
}

export function CategoryPicker({
  categories,
  selectedId,
  onChange,
  readOnly = false,
}: {
  categories: CategoryItem[];
  selectedId: string;
  onChange: (id: string) => void;
  readOnly?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CategoryGroupId>("all");

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedId),
    [categories, selectedId]
  );

  const getGroupBadgeText = (slug: string) => {
    const grp = CATEGORY_TO_GROUP[slug] || "services";
    switch (grp) {
      case "corporate":
        return t("cat_grp.corporate");
      case "daily":
        return t("cat_grp.daily");
      case "dining":
        return t("cat_grp.dining");
      case "auto":
        return t("cat_grp.auto");
      case "services":
      default:
        return t("cat_grp.services");
    }
  };

  const getGroupBadgeColor = (slug: string) => {
    const grp = CATEGORY_TO_GROUP[slug] || "services";
    switch (grp) {
      case "corporate":
        return "#0ea5e9";
      case "daily":
        return "#f59e0b";
      case "dining":
        return "#f97316";
      case "auto":
        return "#06b6d4";
      case "services":
      default:
        return "#10b981";
    }
  };

  const filteredCategories = useMemo(() => {
    let list = categories;

    // Guruh bo'yicha filter
    if (activeGroup !== "all") {
      list = list.filter((c) => (CATEGORY_TO_GROUP[c.slug] || "services") === activeGroup);
    }

    // Qidiruv bo'yicha filter
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((c) => {
      const nameUz = typeof c.name === "object" ? c.name?.uz || "" : c.name || "";
      const nameRu = typeof c.name === "object" ? c.name?.ru || "" : "";
      const nameEn = typeof c.name === "object" ? c.name?.en || "" : "";
      return (
        nameUz.toLowerCase().includes(q) ||
        nameRu.toLowerCase().includes(q) ||
        nameEn.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      );
    });
  }, [categories, activeGroup, search]);

  const getModeBadge = (mode?: string | null) => {
    switch (mode) {
      case "table":
        return t("ab.mode_table");
      case "daily":
        return t("ab.mode_daily");
      case "slots":
      default:
        return t("ab.mode_slots");
    }
  };

  const selectedMeta = selectedCategory ? getCategoryMeta(selectedCategory.slug) : null;
  const SelectedIcon = selectedMeta?.icon;
  const selectedImage = selectedCategory
    ? getCategoryImage(selectedCategory.slug, selectedCategory.image_url)
    : null;

  return (
    <View>
      <Text style={styles.label}>{t("ab.category")}</Text>

      {/* Tanlangan kategoriya kartasi */}
      <Pressable
        onPress={() => !readOnly && setModalOpen(true)}
        style={({ pressed }) => [pressed && !readOnly && { opacity: 0.85 }]}
      >
        <GlassSurface
          style={styles.selectedCard}
          fallbackStyle={styles.selectedCardFallback}
          interactive={!readOnly}
        >
          {selectedCategory ? (
            <View style={styles.selectedContent}>
              {selectedImage ? (
                <Image
                  source={selectedImage}
                  style={styles.selectedImg}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.selectedIconWrap,
                    { backgroundColor: alpha(selectedMeta?.color || colors.primary, 0.15) },
                  ]}
                >
                  {SelectedIcon && (
                    <SelectedIcon size={24} color={selectedMeta?.color || colors.primary} />
                  )}
                </View>
              )}

              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle} numberOfLines={1}>
                  {localize(selectedCategory.name)}
                </Text>

                <View style={styles.badgeRow}>
                  {/* Guruh nishoni: Korporativ, Kunlik/Sutkalik va hk. */}
                  <View
                    style={[
                      styles.groupBadge,
                      {
                        backgroundColor: alpha(
                          getGroupBadgeColor(selectedCategory.slug),
                          0.15
                        ),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupBadgeText,
                        { color: getGroupBadgeColor(selectedCategory.slug) },
                      ]}
                    >
                      {getGroupBadgeText(selectedCategory.slug)}
                    </Text>
                  </View>

                  {/* Band qilish rejimi */}
                  <View
                    style={[
                      styles.modeBadge,
                      { backgroundColor: alpha(colors.primaryContainer, 0.35) },
                    ]}
                  >
                    <Text style={[styles.modeBadgeText, { color: colors.primary }]}>
                      {getModeBadge(selectedCategory.booking_mode)}
                    </Text>
                  </View>
                </View>
              </View>

              {!readOnly && (
                <View style={styles.changeBtn}>
                  <Text style={[styles.changeText, { color: colors.primary }]}>
                    {t("ab.change_category")}
                  </Text>
                  <ChevronRight size={16} color={colors.primary} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderRow}>
              <View
                style={[
                  styles.selectedIconWrap,
                  { backgroundColor: alpha(colors.primaryContainer, 0.2) },
                ]}
              >
                <Sparkles size={22} color={colors.primary} />
              </View>
              <Text style={[styles.placeholderText, { color: colors.outline }]}>
                {t("ab.select_category")}
              </Text>
              {!readOnly && <ChevronRight size={18} color={colors.onSurfaceVariant} />}
            </View>
          )}
        </GlassSurface>
      </Pressable>

      {/* Kategoriyalarni tanlash oynasi (Modal) */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t("ab.select_category")}</Text>
                <Text style={styles.modalSubtitle}>
                  {filteredCategories.length} ta kategoriya
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            {/* Qidiruv qatori */}
            <View style={styles.searchBar}>
              <Search size={18} color={colors.outline} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("ab.search_category")}
                placeholderTextColor={colors.outline}
                style={styles.searchInput}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <X size={16} color={colors.outline} />
                </Pressable>
              )}
            </View>

            {/* 3-4 ta asosiy guruh filter pillslari (Gorizontal scroll) */}
            <View style={styles.groupScrollWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupScrollContent}
              >
                {CATEGORY_GROUPS.map((grp) => {
                  const isActive = activeGroup === grp.id;
                  const GroupIcon = grp.icon;
                  return (
                    <Pressable
                      key={grp.id}
                      onPress={() => setActiveGroup(grp.id)}
                      style={[
                        styles.groupChip,
                        isActive
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            }
                          : {
                              backgroundColor: colors.surfaceContainerLow,
                              borderColor: colors.outlineVariant,
                            },
                      ]}
                    >
                      <GroupIcon
                        size={14}
                        color={isActive ? colors.onPrimary : colors.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.groupChipText,
                          {
                            color: isActive ? colors.onPrimary : colors.onSurface,
                            fontWeight: isActive ? "700" : "500",
                          },
                        ]}
                      >
                        {t(grp.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Kategoriyalar ro'yxati */}
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const meta = getCategoryMeta(item.slug);
                const Icon = meta.icon;
                const isSelected = item.id === selectedId;
                const image = getCategoryImage(item.slug, item.image_url);
                const groupBadgeText = getGroupBadgeText(item.slug);
                const groupBadgeColor = getGroupBadgeColor(item.slug);

                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.id);
                      setModalOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.itemWrap,
                      isSelected && {
                        borderColor: colors.primary,
                        backgroundColor: alpha(colors.primary, 0.08),
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {image ? (
                      <Image
                        source={image}
                        style={styles.itemImg}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.itemIconWrap,
                          { backgroundColor: alpha(meta.color, 0.15) },
                        ]}
                      >
                        <Icon size={22} color={meta.color} />
                      </View>
                    )}

                    <View style={styles.itemTextWrap}>
                      <Text
                        style={[
                          styles.itemTitle,
                          isSelected && { color: colors.primary, fontWeight: "700" },
                        ]}
                        numberOfLines={1}
                      >
                        {localize(item.name)}
                      </Text>

                      <View style={styles.itemBadgesRow}>
                        <View
                          style={[
                            styles.groupBadge,
                            { backgroundColor: alpha(groupBadgeColor, 0.15) },
                          ]}
                        >
                          <Text
                            style={[styles.groupBadgeText, { color: groupBadgeColor }]}
                          >
                            {groupBadgeText}
                          </Text>
                        </View>

                        <Text style={styles.itemSub} numberOfLines={1}>
                          • {getModeBadge(item.booking_mode)}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                        <Check size={14} color={colors.onPrimary} />
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    selectedCard: {
      borderRadius: radius.lg,
      padding: 12,
      overflow: "hidden",
    },
    selectedCardFallback: {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
    },
    selectedContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    selectedImg: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
    },
    selectedIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedInfo: {
      flex: 1,
      minWidth: 0,
    },
    selectedTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onSurface,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      flexWrap: "wrap",
    },
    groupBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    groupBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    modeBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    modeBadgeText: {
      fontSize: 10,
      fontWeight: "600",
    },
    changeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    changeText: {
      fontSize: 13,
      fontWeight: "600",
    },
    placeholderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    placeholderText: {
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: colors.surfaceContainerLowest,
      borderTopLeftRadius: radius.xxxl,
      borderTopRightRadius: radius.xxxl,
      maxHeight: "88%",
      height: "88%",
      paddingTop: 16,
      paddingBottom: 24,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.onSurface,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.6),
      alignItems: "center",
      justifyContent: "center",
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.onSurface,
      padding: 0,
    },

    // Guruh filter scroll
    groupScrollWrap: {
      marginBottom: 6,
    },
    groupScrollContent: {
      paddingHorizontal: 16,
      gap: 8,
      paddingVertical: 4,
    },
    groupChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    groupChipText: {
      fontSize: 12,
    },

    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    itemWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    itemImg: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
    },
    itemIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    itemTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.onSurface,
    },
    itemBadgesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    itemSub: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
