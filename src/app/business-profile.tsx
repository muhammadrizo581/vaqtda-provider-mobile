// Biznes profili yaratish/tahrirlash — _port_reference/CreateBusinessProfile.tsx,
// useBusinessProfile.ts va business.ts dan port. Rasm: expo-image-picker,
// xarita: WebView Yandex Maps, tarjima: bevosita utils/translate.ts.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera, Star, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
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
import { LocationPicker } from "@/components/pv/location-picker";
import { SelectField } from "@/components/pv/select-field";
import { useToast } from "@/components/pv/toast";
import { GlassIconButton, GlassSurface, SmallButton } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { translateMultilingual } from "@/utils/translate";

interface PickedImage {
  uri: string;
  mimeType: string;
  is_primary: boolean;
  /** business_images jadvalidagi id — avval yuklangan rasmlar uchun */
  existingId?: string;
}

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

export default function BusinessProfileScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { provider, reload } = useProvider();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const editId = provider?.id || null;

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: any }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [about, setAbout] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mapCoordinates, setMapCoordinates] = useState<[number, number]>([41.2995, 69.2401]);
  const [images, setImages] = useState<PickedImage[]>([]);
  // O'chirilgan mavjud rasmlar — saqlashda DB/storage'dan olib tashlanadi
  const [removedExisting, setRemovedExisting] = useState<{ id: string; uri: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  // Kategoriya va hududlarni yuklaymiz
  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase.from("categories").select("id, name");
      const sorted = cats
        ? [...cats].sort((a, b) => localize(a.name).localeCompare(localize(b.name)))
        : [];
      setCategories(sorted);
      if (sorted.length > 0) setSelectedCategoryId((prev) => prev || sorted[0].id);

      const { data: regs } = await supabase
        .from("regions")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setRegions(regs || []);
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
      if (provider.category_id) setSelectedCategoryId(provider.category_id);
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

  const removeImage = (idx: number) =>
    setImages((prev) => {
      const removed = prev[idx];
      if (removed?.existingId) {
        setRemovedExisting((r) => [...r, { id: removed.existingId!, uri: removed.uri }]);
      }
      const filtered = prev.filter((_, i) => i !== idx);
      if (removed?.is_primary && filtered.length > 0) filtered[0].is_primary = true;
      return filtered;
    });

  const handleSubmit = async () => {
    if (!user) return;
    if (!businessName.trim()) {
      Alert.alert("", t("ab.business_name"));
      return;
    }
    if (!selectedCategoryId || (regions.length > 0 && !selectedRegionId)) {
      Alert.alert("", t("ab.select_region"));
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

      const baseSlug = slug.trim() || businessName;
      const formattedSlug = baseSlug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s\-_]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const payload = {
        business_name: businessName,
        slug: formattedSlug,
        location: `${mapCoordinates[0]}, ${mapCoordinates[1]}`,
        about: aboutValue,
        category_id: selectedCategoryId,
        phone_number: phoneNumber,
        region_id: selectedRegionId || null,
      };

      setStatus(t("common.saving"));
      let providerId: string;
      if (editId) {
        const { error } = await supabase.from("providers").update(payload).eq("id", editId);
        if (error) throw new Error(error.message);
        providerId = editId;
      } else {
        const { data, error } = await supabase
          .from("providers")
          .insert({ user_id: user.id, ...payload })
          .select()
          .single();
        if (error || !data) throw new Error(error?.message || "insert failed");
        providerId = data.id;
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
      await reload();
      router.back();
    } catch (e: any) {
      console.error("Submission failed:", e);
      showToast(e?.message || t("svc.save_failed"), "error");
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
          <Text style={styles.title}>{editId ? t("ab.edit_title") : t("ab.title")}</Text>
        </View>

        {/* Asosiy ma'lumot */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <View>
            <Text style={styles.label}>{t("ab.business_name")}</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder={t("ab.business_name_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("ab.slug")}</Text>
            <TextInput
              value={slug}
              onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9\-_]/g, ""))}
              autoCapitalize="none"
              placeholder="my-business"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <Text style={styles.hint}>{t("ab.slug_hint")}</Text>
          </View>

          <SelectField
            label={t("ab.category")}
            value={selectedCategoryId}
            options={categories.map((c) => ({ value: c.id, label: localize(c.name) }))}
            placeholder={t("ab.loading_categories")}
            onChange={setSelectedCategoryId}
          />

          <SelectField
            label={t("ab.select_region")}
            value={selectedRegionId}
            options={regions.map((r) => ({ value: r.id, label: localize(r.name) }))}
            placeholder={t("ab.select_region")}
            onChange={setSelectedRegionId}
          />

          <View>
            <Text style={styles.label}>{t("ab.about")}</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder={t("ab.about_ph")}
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={4}
              style={[styles.input, { minHeight: 96, textAlignVertical: "top" }]}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("ab.phone")}</Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(v) => setPhoneNumber(formatUzPhone(v))}
              keyboardType="phone-pad"
              placeholder="+998 (90) 123 45 67"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>
        </GlassSurface>

        {/* Joylashuv */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <Text style={styles.label}>{t("ab.location")}</Text>
          <LocationPicker coordinates={mapCoordinates} onChange={setMapCoordinates} />
          <Text style={styles.hint}>
            {mapCoordinates[0]}, {mapCoordinates[1]}
          </Text>
        </GlassSurface>

        {/* Rasmlar */}
        <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
          <Text style={styles.label}>{t("ab.photos")}</Text>
          <View style={styles.imagesRow}>
            {images.map((img, i) => (
              <View key={img.uri + i} style={styles.imageWrap}>
                <Image source={{ uri: img.uri }} style={styles.image} contentFit="cover" />
                <Pressable style={styles.imageRemove} onPress={() => removeImage(i)}>
                  <X size={12} color={colors.onErrorContainer} />
                </Pressable>
                <Pressable
                  style={[
                    styles.imagePrimary,
                    img.is_primary && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => togglePrimary(i)}
                >
                  <Star
                    size={12}
                    color={img.is_primary ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addImage} onPress={pickImages}>
              <Camera size={20} color={colors.primary} />
            </Pressable>
          </View>
        </GlassSurface>

        {/* Yuborish */}
        {submitting ? (
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
    backgroundColor: colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePrimary: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: alpha("#000000", 0.5),
    alignItems: "center",
    justifyContent: "center",
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

  submitting: { alignItems: "center", gap: 8, paddingVertical: 12 },
  submittingText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600" },
}));
