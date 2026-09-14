// Biznes profili yaratish/tahrirlash — _port_reference/CreateBusinessProfile.tsx,
// useBusinessProfile.ts va business.ts dan port. Rasm: expo-image-picker,
// xarita: WebView Yandex Maps, tarjima: bevosita utils/translate.ts.
//
// Klinika XODIMI (shifokor) shu sahifani KO'RADI, lekin tahrirlay olmaydi:
// maydonlar qulflanadi, rasm tanlash va saqlash tugmasi ko'rsatilmaydi.
// Ega uchun hech narsa o'zgarmaydi.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera, Check, ChevronRight, Crown, HelpCircle, Lock, Star, User, Users, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedLogo } from "@/components/animated-logo";
import { CategoryPicker, type CategoryItem } from "@/components/pv/category-picker";
import { LocationPicker } from "@/components/pv/location-picker";
import { SelectField } from "@/components/pv/select-field";
import { useToast } from "@/components/pv/toast";
import { GlassIconButton, GlassSurface, SmallButton } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { getMemoryCache, invalidateCache, readCache, writeCache, TTL_STATIC } from "@/lib/offline-cache";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { planStatusSubtitle } from "@/utils/plan";
import { translateMultilingual } from "@/utils/translate";

interface PickedImage {
  uri: string;
  mimeType: string;
  is_primary: boolean;
  /** business_images jadvalidagi id — avval yuklangan rasmlar uchun */
  existingId?: string;
}

export const DUAL_CATEGORIES = new Set([
  "sartaroshxona",
  "gozallik-saloni",
  "tirnoq",
  "kosmetolog",
  "klinika",
]);

export const STRICTLY_INDIVIDUAL_CATEGORIES = new Set([
  "epilyatsiya",
  "stomatolog",
  "fotostudiya",
  "psixolog",
]);

// +998 (XX) XXX XX XX ko'rinishida formatlash (web'dagi IMask o'rnida)
function formatUzPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  let out = "+998";
  if (digits.length > 0) out += ` (${digits.slice(0, 2)}`;
  if (digits.length >= 2) out += ")";
  if (digits.length > 2) out += ` ${digits.slice(2, 5)}`;
  if (digits.length > 5) out += ` ${digits.slice(5, 7)}`;
  if (digits.length > 7) out += ` ${digits.slice(7, 9)}`;
  return out;
}

// Faqat ko'rish uchun maydon — SelectField o'rnida (tanlash oynasi ochilmaydi)
function ReadonlyField({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.roField}>
        <Text style={styles.roValue} numberOfLines={2}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

export default function BusinessProfileScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { provider, reload } = useProvider();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  // Shifokor — klinika ma'lumotlarini faqat ko'radi
  const { isStaff } = useStaffRoleContext();
  const readOnly = isStaff;

  const editId = provider?.id || null;

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid_length"
  >("idle");
  const [slugMessage, setSlugMessage] = useState<string>("");
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    getMemoryCache<CategoryItem[]>("categories.all") || []
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [businessType, setBusinessType] = useState<"corporate" | "individual">("corporate");
  // Biznes formati yonidagi (?) — bosilganda qisqa izoh ochiladi
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>(() =>
    getMemoryCache<{ id: string; name: string }[]>("regions.all") || []
  );
  const [selectedRegionId, setSelectedRegionId] = useState("");

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSlug = selectedCategory?.slug || "";
  const isDualCategory = DUAL_CATEGORIES.has(selectedSlug);
  const isStrictlyIndividual = STRICTLY_INDIVIDUAL_CATEGORIES.has(selectedSlug);
  const [about, setAbout] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mapCoordinates, setMapCoordinates] = useState<[number, number]>([41.2995, 69.2401]);
  const [images, setImages] = useState<PickedImage[]>([]);
  // O'chirilgan mavjud rasmlar — saqlashda DB/storage'dan olib tashlanadi
  const [removedExisting, setRemovedExisting] = useState<{ id: string; uri: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  // Yangi biznes yaratilayotganda slug profildagi username'dan boshlanadi —
  // slug va username har doim bir xil turadi (DB trigger ham sinxron saqlaydi).
  useEffect(() => {
    if (provider || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.username) setSlug((prev) => prev || data.username);
    })();
  }, [provider, user]);

  // Username (slug) bandligini real-vaqtda tekshirish (Instagram uslubida).
  // Holat setTimeout ichida yangilanadi — effekt ichida sinxron setState bo'lmasligi uchun.
  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    // Agar bu foydalanuvchining joriy username'i bo'lsa — bazaga so'rov shart emas
    const currentSlug = (provider?.slug || "").trim().toLowerCase();
    let localResult: [typeof slugStatus, string] | null = null;
    if (!trimmed) localResult = ["idle", ""];
    else if (trimmed.length < 3) localResult = ["invalid_length", "Kamida 3 ta belgi bo'lishi kerak"];
    else if (trimmed.length > 30) localResult = ["invalid_length", "Maksimal 30 ta belgi"];
    else if (currentSlug && trimmed === currentSlug) localResult = ["available", "Sizning joriy usernamingiz"];

    const immediate = setTimeout(() => {
      const [status, message] = localResult ?? ["checking", "Tekshirilmoqda..."];
      setSlugStatus(status);
      setSlugMessage(message);
    }, 0);
    if (localResult) return () => clearTimeout(immediate);

    const timer = setTimeout(async () => {
      try {
        // 1. profiles jadvalida boshqa foydalanuvchi band qilganmi?
        let profileQ = supabase.from("profiles").select("id").eq("username", trimmed);
        if (user?.id) profileQ = profileQ.neq("id", user.id);
        const { data: profMatch } = await profileQ.maybeSingle();

        if (profMatch) {
          setSlugStatus("taken");
          setSlugMessage("Bu username allaqachon band qilingan");
          return;
        }

        // 2. providers jadvalida boshqa biznes band qilganmi?
        let provQ = supabase.from("providers").select("id").eq("slug", trimmed);
        if (editId) provQ = provQ.neq("id", editId);
        const { data: provMatch } = await provQ.maybeSingle();

        if (provMatch) {
          setSlugStatus("taken");
          setSlugMessage("Bu username allaqachon band qilingan");
          return;
        }

        setSlugStatus("available");
        setSlugMessage("Ushbu username bo'sh!");
      } catch {
        setSlugStatus("idle");
        setSlugMessage("");
      }
    }, 400);

    return () => {
      clearTimeout(immediate);
      clearTimeout(timer);
    };
  }, [slug, provider?.slug, user?.id, editId]);

  // Kategoriya va hududlarni yuklaymiz (RAM va Disk kesh orqali tezkor)
  useEffect(() => {
    (async () => {
      // 1. Agar RAM bo'sh bo'lsa, tezda disk keshini tekshiramiz
      const diskCats = await readCache<CategoryItem[]>("categories.all");
      if (diskCats && diskCats.length > 0) {
        setCategories(diskCats);
      }
      const diskRegs = await readCache<{ id: string; name: string }[]>("regions.all");
      if (diskRegs && diskRegs.length > 0) {
        setRegions(diskRegs);
      }

      // 2. Supabase'dan fonda yangilaymiz
      try {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name, slug, image_url, booking_mode, uses_departments, uses_staff, sort_order")
          .order("sort_order", { ascending: true });
        const sorted = (cats as CategoryItem[]) || [];
        if (sorted.length > 0) {
          setCategories(sorted);
          await writeCache("categories.all", sorted, TTL_STATIC);
        }

        const { data: regs } = await supabase
          .from("regions")
          .select("id, name, slug")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (regs && regs.length > 0) {
          setRegions(regs);
          await writeCache("regions.all", regs, TTL_STATIC);
        }
      } catch {
        // Tarmoq xatosi bo'lsa kesh yetarli
      }
    })();
  }, []);

  // Mavjud biznesni formaga chiqaramiz (EDIT rejimi).
  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun.
  useEffect(() => {
    if (!provider) return;
    const t = setTimeout(() => {
      setBusinessName(localize(provider.business_name) || "");
      setSlug(provider.slug || "");
      setAbout(localize(provider.about) || "");
      setPhoneNumber(provider.phone_number || "");
      if (provider.location) {
        const parts = String(provider.location)
          .split(",")
          .map((p) => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          setMapCoordinates([parts[0], parts[1]]);
        }
      }
      setSelectedCategoryId(provider.category_id || "");
      if (provider.business_type === "individual" || provider.business_type === "corporate") {
        setBusinessType(provider.business_type);
      }
      if (provider.region_id) setSelectedRegionId(provider.region_id);
    }, 0);
    return () => clearTimeout(t);
  }, [provider]);

  // Avval yuklangan rasmlarni ko'rsatamiz (EDIT rejimi)
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase
        .from("business_images")
        .select("id, image_url, is_primary")
        .eq("provider_id", editId)
        .order("is_primary", { ascending: false });
      if (!data) return;
      setImages((prev) =>
        prev.some((p) => p.existingId)
          ? prev
          : [
              ...data.map((d) => ({
                uri: d.image_url as string,
                mimeType: "",
                is_primary: !!d.is_primary,
                existingId: d.id as string,
              })),
              ...prev,
            ]
      );
    })();
  }, [editId]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setImages((prev) => {
      const updated = [...prev];
      result.assets.forEach((a) => {
        updated.push({
          uri: a.uri,
          mimeType: a.mimeType || "image/jpeg",
          is_primary: updated.length === 0,
        });
      });
      return updated;
    });
  };

  const togglePrimary = (idx: number) =>
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === idx })));

  const removeImage = (idx: number) => {
    const removed = images[idx];
    if (!removed) return;
    if (removed.existingId) {
      setRemovedExisting((r) => [...r, { id: removed.existingId!, uri: removed.uri }]);
    }
    setImages((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      // Asosiy rasm o'chsa — birinchisi asosiy bo'ladi (state obyektini mutatsiya qilmasdan)
      if (removed.is_primary && filtered.length > 0) {
        return filtered.map((img, i) => (i === 0 ? { ...img, is_primary: true } : img));
      }
      return filtered;
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!businessName.trim()) {
      Alert.alert("", t("ab.business_name"));
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert("", t("ab.select_category"));
      return;
    }
    if (regions.length > 0 && !selectedRegionId) {
      Alert.alert("", t("ab.select_region"));
      return;
    }
    if (slugStatus === "taken") {
      Alert.alert("", "Ushbu username allaqachon band qilingan. Iltimos, boshqa username tanlang.");
      return;
    }
    if (slugStatus === "invalid_length") {
      Alert.alert("", "Username kamida 3 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (slugStatus === "checking") {
      Alert.alert("", "Username bandligi tekshirilmoqda, iltimos kuting...");
      return;
    }
    setSubmitting(true);
    try {
      // "about" matnini avtomatik uz/ru/en ga tarjima qilamiz
      let aboutValue: string | Record<string, string> = about;
      if (about && about.trim()) {
        setStatus(t("common.loading"));
        try {
          aboutValue = await translateMultilingual(about);
        } catch {
          /* tarjima bo'lmasa — oddiy matn bilan davom etamiz */
        }
      }

      // Slug = username qoidasi: maydon bo'sh qolsa slug yubormaymiz —
      // yangi biznesda DB trigger username'dan qo'yadi, tahrirda eskisi qoladi.
      // Slug o'zgartirilsa DB trigger profildagi username'ni ham yangilaydi.
      const trimmedSlug = slug.trim();
      const formattedSlug = trimmedSlug
        ? trimmedSlug
            .toLowerCase()
            .replace(/[^a-z0-9\s\-_.]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
        : null;

      const finalBusinessType = isStrictlyIndividual
        ? "individual"
        : isDualCategory
        ? businessType
        : (provider?.business_type || "corporate");

      const payload = {
        business_name: businessName,
        ...(formattedSlug ? { slug: formattedSlug } : {}),
        location: `${mapCoordinates[0]}, ${mapCoordinates[1]}`,
        about: aboutValue,
        category_id: selectedCategoryId,
        business_type: finalBusinessType,
        phone_number: phoneNumber,
        region_id: selectedRegionId || null,
      };

      setStatus(t("common.saving"));
      let providerId: string;
      if (editId) {
        let updateErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await supabase.from("providers").update(payload).eq("id", editId);
          if (!error) {
            updateErr = null;
            break;
          }
          updateErr = error;
          const msg = String(error?.message || "");
          if (msg.includes("network") || msg.includes("fetch") || msg.includes("lost")) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          break;
        }
        if (updateErr) throw new Error(updateErr.message);
        providerId = editId;
      } else {
        let insertErr: any = null;
        let insertedData: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase
            .from("providers")
            .insert({ user_id: user.id, ...payload })
            .select()
            .single();
          if (!error && data) {
            insertedData = data;
            insertErr = null;
            break;
          }
          insertErr = error;
          const msg = String(error?.message || "");
          if (msg.includes("network") || msg.includes("fetch") || msg.includes("lost")) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          break;
        }
        if (insertErr || !insertedData) throw new Error(insertErr?.message || "insert failed");
        providerId = insertedData.id;
      }

      // O'chirilgan mavjud rasmlarni DB va storage'dan olib tashlaymiz
      if (removedExisting.length > 0) {
        await supabase
          .from("business_images")
          .delete()
          .in(
            "id",
            removedExisting.map((r) => r.id)
          );
        // Storage'dan tozalash — best-effort, xato bo'lsa saqlashni to'xtatmaymiz
        try {
          const paths = removedExisting
            .map((r) => decodeURIComponent(r.uri.split("/business_images/")[1] || ""))
            .filter(Boolean);
          if (paths.length > 0) {
            await supabase.storage.from("business_images").remove(paths);
          }
        } catch {
          /* ignore */
        }
      }

      // Mavjud rasmlarning "asosiy" belgisi o'zgargan bo'lishi mumkin
      for (const img of images.filter((i) => i.existingId)) {
        await supabase
          .from("business_images")
          .update({ is_primary: img.is_primary })
          .eq("id", img.existingId!);
        if (img.is_primary) {
          await supabase.from("providers").update({ avatar_url: img.uri }).eq("id", providerId);
        }
      }

      // Yangi rasmlarni storage'ga yuklab, business_images jadvaliga yozamiz
      const newImages = images.filter((i) => !i.existingId);
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        setStatus(`${t("common.loading")} (${i + 1}/${newImages.length})`);
        const ext = img.mimeType.split("/")[1] || "jpg";
        const filePath = `${user.id}/${Date.now()}-${i}.${ext}`;

        const arraybuffer = await fetch(img.uri).then((res) => res.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from("business_images")
          .upload(filePath, arraybuffer, { contentType: img.mimeType });
        if (uploadError) throw new Error(uploadError.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from("business_images").getPublicUrl(filePath);

        const { error: dbImageError } = await supabase.from("business_images").insert({
          provider_id: providerId,
          image_url: publicUrl,
          is_primary: img.is_primary,
        });
        if (dbImageError) throw new Error(dbImageError.message);

        if (img.is_primary) {
          await supabase.from("providers").update({ avatar_url: publicUrl }).eq("id", providerId);
        }
      }

      showToast(t("svc.saved"));
      invalidateCache("provider.").catch(() => {});
      await reload();
      router.back();
    } catch (e: any) {
      console.error("Submission failed:", e);
      const msg = String(e?.message || "");
      if (
        msg.includes("network") ||
        msg.includes("connection was lost") ||
        msg.includes("fetch failed")
      ) {
        showToast("Tarmoq bilan aloqa uzildi. Qayta urinib ko'ring.", "error");
      } else {
        showToast(e?.message || t("svc.save_failed"), "error");
      }
    } finally {
      setSubmitting(false);
      setStatus("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <Text style={styles.title}>
            {readOnly ? t("biz.view_title") : editId ? t("ab.edit_title") : t("ab.title")}
          </Text>
        </View>

        {/* Tarif holati — faqat biznes egasi uchun */}
        {!readOnly && provider ? (
          <Pressable onPress={() => router.push("/plan")}>
            <GlassSurface style={styles.planBanner} fallbackStyle={styles.planBannerFallback} interactive>
              <View style={[styles.planBannerIcon, { backgroundColor: alpha(colors.tertiaryContainer, 0.25) }]}>
                <Crown size={18} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.planBannerTitle}>{t("pv.more_plan")}</Text>
                  <View
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: radius.sm,
                      backgroundColor:
                        provider?.subscription_status === "trial"
                          ? alpha(colors.tertiaryContainer, 0.35)
                          : alpha(colors.primaryContainer, 0.35),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color:
                          provider?.subscription_status === "trial"
                            ? colors.tertiary
                            : colors.primary,
                        textTransform: "uppercase",
                      }}
                    >
                      {provider?.subscription_status === "trial"
                        ? t("plan.badge_trial")
                        : (provider?.plan_code || "pro").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.planBannerSub} numberOfLines={1}>
                  {planStatusSubtitle(provider, t)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.onSurfaceVariant} />
            </GlassSurface>
          </Pressable>
        ) : null}

        {/* Xodimga: sahifa qulflangan ekanini qisqa izohlaymiz */}
        {readOnly ? (
          <GlassSurface style={styles.noteBox} fallbackStyle={styles.noteBoxFallback}>
            <Lock size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.noteText}>{t("biz.readonly_note")}</Text>
          </GlassSurface>
        ) : null}

        {/* Asosiy ma'lumot */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <View>
            <Text style={styles.label}>{t("ab.business_name")}</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              editable={!readOnly}
              placeholder={t("ab.business_name_ph")}
              placeholderTextColor={colors.outline}
              style={[styles.input, readOnly && styles.inputReadonly]}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("ab.slug")}</Text>
            <View
              style={[
                styles.usernameRow,
                slugStatus === "available" && styles.usernameRowAvailable,
                (slugStatus === "taken" || slugStatus === "invalid_length") && styles.usernameRowTaken,
                readOnly && styles.inputReadonly,
              ]}
            >
              <View
                style={[
                  styles.atBadge,
                  slugStatus === "available" && styles.atBadgeAvailable,
                  (slugStatus === "taken" || slugStatus === "invalid_length") && styles.atBadgeTaken,
                ]}
              >
                <Text
                  style={[
                    styles.atText,
                    slugStatus === "available" && styles.atTextAvailable,
                    (slugStatus === "taken" || slugStatus === "invalid_length") && styles.atTextTaken,
                  ]}
                >
                  @
                </Text>
              </View>
              <TextInput
                value={slug}
                onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9\-_.]/g, ""))}
                editable={!readOnly}
                autoCapitalize="none"
                placeholder={t("ab.slug_ph") || "barber_one"}
                placeholderTextColor={colors.outline}
                style={[styles.usernameInput, readOnly && styles.inputReadonly]}
              />
              {!readOnly && (
                <View style={styles.usernameStatusWrap}>
                  {slugStatus === "checking" ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : slugStatus === "available" ? (
                    <View style={styles.statusIconWrapAvailable}>
                      <Check size={13} color="#ffffff" />
                    </View>
                  ) : slugStatus === "taken" || slugStatus === "invalid_length" ? (
                    <View style={styles.statusIconWrapTaken}>
                      <X size={13} color="#ffffff" />
                    </View>
                  ) : null}
                </View>
              )}
            </View>
            {readOnly ? null : slugMessage ? (
              <Text
                style={[
                  styles.slugStatusText,
                  slugStatus === "available" && styles.slugStatusTextAvailable,
                  (slugStatus === "taken" || slugStatus === "invalid_length") && styles.slugStatusTextTaken,
                ]}
              >
                {slugStatus === "available" ? "✓ " : slugStatus === "taken" || slugStatus === "invalid_length" ? "✕ " : ""}
                {slugMessage}
              </Text>
            ) : (
              <Text style={styles.hint}>{t("ab.slug_hint")}</Text>
            )}
          </View>

          <CategoryPicker
            categories={categories}
            selectedId={selectedCategoryId}
            onChange={(id) => {
              setSelectedCategoryId(id);
              const cat = categories.find((c) => c.id === id);
              if (cat && STRICTLY_INDIVIDUAL_CATEGORIES.has(cat.slug)) {
                setBusinessType("individual");
              }
            }}
            readOnly={readOnly}
          />

          {isDualCategory ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.label}>{t("ab.business_type")}</Text>
                <Pressable onPress={() => setShowFormatHelp((v) => !v)} hitSlop={10}>
                  <HelpCircle
                    size={15}
                    color={showFormatHelp ? colors.primary : colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
              {showFormatHelp ? (
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 17,
                    color: colors.onSurfaceVariant,
                    padding: 10,
                    borderRadius: radius.md,
                    overflow: "hidden",
                    backgroundColor: alpha(colors.primary, 0.08),
                  }}
                >
                  {t("ab.type_help")}
                </Text>
              ) : null}
              <View style={styles.formatRow}>
                <Pressable
                  disabled={readOnly}
                  onPress={() => setBusinessType("corporate")}
                  style={[
                    styles.formatCard,
                    businessType === "corporate" && styles.formatCardActive,
                  ]}
                >
                  <View style={styles.formatCardTop}>
                    <View
                      style={[
                        styles.formatIconWrap,
                        businessType === "corporate" && styles.formatIconWrapActive,
                      ]}
                    >
                      <Users
                        size={18}
                        color={businessType === "corporate" ? colors.primary : colors.onSurfaceVariant}
                      />
                    </View>
                    {businessType === "corporate" ? (
                      <View style={styles.checkBadge}>
                        <Check size={12} color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.formatCardTitle,
                      businessType === "corporate" && styles.formatCardTitleActive,
                    ]}
                  >
                    {t("ab.type_corporate")}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={readOnly}
                  onPress={() => setBusinessType("individual")}
                  style={[
                    styles.formatCard,
                    businessType === "individual" && styles.formatCardActive,
                  ]}
                >
                  <View style={styles.formatCardTop}>
                    <View
                      style={[
                        styles.formatIconWrap,
                        businessType === "individual" && styles.formatIconWrapActive,
                      ]}
                    >
                      <User
                        size={18}
                        color={businessType === "individual" ? colors.primary : colors.onSurfaceVariant}
                      />
                    </View>
                    {businessType === "individual" ? (
                      <View style={styles.checkBadge}>
                        <Check size={12} color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.formatCardTitle,
                      businessType === "individual" && styles.formatCardTitleActive,
                    ]}
                  >
                    {t("ab.type_individual")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {readOnly ? (
            <ReadonlyField
              label={t("ab.select_region")}
              value={localize(regions.find((r) => r.id === selectedRegionId)?.name)}
            />
          ) : (
            <SelectField
              label={t("ab.select_region")}
              value={selectedRegionId}
              options={regions.map((r) => ({ value: r.id, label: localize(r.name) }))}
              placeholder={t("ab.select_region")}
              onChange={setSelectedRegionId}
            />
          )}

          <View>
            <Text style={styles.label}>{t("ab.about")}</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              editable={!readOnly}
              placeholder={t("ab.about_ph")}
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={4}
              style={[
                styles.input,
                { minHeight: 96, textAlignVertical: "top" },
                readOnly && styles.inputReadonly,
              ]}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("ab.phone")}</Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(v) => setPhoneNumber(formatUzPhone(v))}
              editable={!readOnly}
              keyboardType="phone-pad"
              placeholder="+998 (90) 123 45 67"
              placeholderTextColor={colors.outline}
              style={[styles.input, readOnly && styles.inputReadonly]}
            />
          </View>
        </GlassSurface>

        {/* Joylashuv */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <Text style={styles.label}>{t("ab.location")}</Text>
          <LocationPicker
            coordinates={mapCoordinates}
            onChange={(coords) => setMapCoordinates(coords)}
            readOnly={readOnly}
          />
        </GlassSurface>

        {/* Rasmlar */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <Text style={styles.label}>{t("ab.photos")}</Text>
          <View style={styles.imagesRow}>
            {images.map((img, i) => (
              <View key={img.uri + i} style={styles.imageWrap}>
                <Image source={{ uri: img.uri }} style={styles.image} contentFit="cover" />
                {/* Xodimda rasm o'chirish/asosiy qilish tugmalari yo'q */}
                {readOnly ? null : (
                  <>
                    <Pressable style={styles.imageRemove} onPress={() => removeImage(i)}>
                      <GlassSurface
                        style={styles.imageBtnGlass}
                        fallbackStyle={{ backgroundColor: colors.errorContainer }}
                        tintColor={alpha(colors.errorContainer, 0.6)}
                        interactive
                      >
                        <X size={12} color={colors.onErrorContainer} />
                      </GlassSurface>
                    </Pressable>
                    <Pressable style={styles.imagePrimary} onPress={() => togglePrimary(i)}>
                      <GlassSurface
                        style={styles.imageBtnGlass}
                        fallbackStyle={{
                          backgroundColor: img.is_primary ? colors.primary : alpha("#000000", 0.5),
                        }}
                        tintColor={img.is_primary ? colors.primary : undefined}
                        interactive
                      >
                        <Star
                          size={12}
                          color={img.is_primary ? colors.onPrimary : colors.onSurfaceVariant}
                        />
                      </GlassSurface>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
            {readOnly ? (
              images.length === 0 ? (
                <Text style={styles.hint}>{t("biz.no_photos")}</Text>
              ) : null
            ) : (
              <Pressable style={styles.addImage} onPress={pickImages}>
                <Camera size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </GlassSurface>

        {/* Yuborish — xodimda saqlash tugmasi umuman ko'rsatilmaydi */}
        {readOnly ? null : submitting ? (
          <View style={styles.submitting}>
            <AnimatedLogo variant="loading" size={48} />
            {status ? <Text style={styles.submittingText}>{status}</Text> : null}
          </View>
        ) : (
          <SmallButton
            label={editId ? t("common.save") : t("ab.submit")}
            onPress={handleSubmit}
            style={{ paddingVertical: 14 }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface, flex: 1 },

  planBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  planBannerFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  planBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  planBannerTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  planBannerSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  card: {
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  cardFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: colors.onSurface,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  atBadge: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: alpha(colors.primaryContainer, 0.25),
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  atText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  usernameInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: colors.onSurface,
  },
  usernameStatusWrap: {
    paddingRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconWrapAvailable: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconWrapTaken: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  usernameRowAvailable: {
    borderColor: "#10b981",
  },
  usernameRowTaken: {
    borderColor: "#ef4444",
  },
  atBadgeAvailable: {
    backgroundColor: alpha("#10b981", 0.15),
    borderRightColor: alpha("#10b981", 0.3),
  },
  atBadgeTaken: {
    backgroundColor: alpha("#ef4444", 0.15),
    borderRightColor: alpha("#ef4444", 0.3),
  },
  atTextAvailable: {
    color: "#10b981",
  },
  atTextTaken: {
    color: "#ef4444",
  },
  slugStatusText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  slugStatusTextAvailable: {
    color: "#10b981",
  },
  slugStatusTextTaken: {
    color: "#ef4444",
  },
  // Faqat ko'rish: maydon o'chirilgandek ko'rinadi, lekin joylashuv o'zgarmaydi
  inputReadonly: {
    color: colors.onSurfaceVariant,
    backgroundColor: alpha(colors.surfaceContainerHighest, 0.5),
  },
  roField: {
    backgroundColor: alpha(colors.surfaceContainerHighest, 0.5),
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roValue: { fontSize: 14, fontWeight: "500", color: colors.onSurfaceVariant },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  noteBoxFallback: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  noteText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },

  hint: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 },

  imagesRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageWrap: { width: 88, height: 88, borderRadius: radius.md, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  imageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
  },
  imagePrimary: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
  },
  imageBtnGlass: {
    flex: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  addImage: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(colors.primary, 0.4),
    alignItems: "center",
    justifyContent: "center",
  },

  formatRow: {
    flexDirection: "row",
    gap: 10,
  },
  formatCard: {
    flex: 1,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    gap: 6,
  },
  formatCardActive: {
    borderColor: colors.primary,
    backgroundColor: alpha(colors.primaryContainer, 0.2),
  },
  formatCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formatIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: alpha(colors.onSurface, 0.06),
    alignItems: "center",
    justifyContent: "center",
  },
  formatIconWrapActive: {
    backgroundColor: alpha(colors.primary, 0.15),
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  formatCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  formatCardTitleActive: {
    color: colors.primary,
  },
  formatCardSub: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.onSurfaceVariant,
  },

  submitting: { alignItems: "center", gap: 8, paddingVertical: 12 },
  submittingText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600" },
}));
