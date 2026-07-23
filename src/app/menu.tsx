// Restoran menyusi boshqaruvi — saytdagi app/dashboard/menu/page.tsx dan port.
// Faqat booking_mode="table" (restoran/kafe) kategoriyalarda ma'noga ega.
// Mijoz stol bron qilayotganda shu taomlardan oldindan buyurtma qiladi
// (booking_menu_items). Har taomga bitta rasm — "menu-images" bucket.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  Card,
  EmptyState,
  GlassIconButton,
  GlassSurface,
  PageHeader,
  SmallButton,
  Spinner,
  TogglePill,
} from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProvider } from "@/context/ProviderContext";
import { useBookingMode } from "@/hooks/useBookingMode";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { formatSom } from "@/utils/price";
import { translateMultilingual } from "@/utils/translate";

interface MenuItem {
  id: string;
  provider_id: string;
  // jsonb {uz,ru,en} yoki matn — localize() bilan ko'rsatiladi
  name: any;
  description: any;
  price: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

// Taom rasmi uchun maksimal hajm
const MAX_IMAGE_MB = 5;

function MenuContent() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const router = useRouter();
  const { mode, loading: modeLoading } = useBookingMode();
  const providerId = provider?.id || null;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form holati
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  // Rasm: bitta — yangi tanlangan lokal fayl yoki mavjud URL
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data as MenuItem[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const tm = setTimeout(load, 0);
    return () => clearTimeout(tm);
  }, [load]);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setPrice("");
    setDescription("");
    setActive(true);
    setImageAsset(null);
    setImageUrl(null);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (m: MenuItem) => {
    setEditId(m.id);
    setName(localize(m.name, lang) || "");
    setPrice(m.price != null ? String(m.price) : "");
    setDescription(localize(m.description, lang) || "");
    setActive(m.is_active);
    setImageAsset(null);
    setImageUrl(m.image_url);
    setFormOpen(true);
  };

  // Rasm tanlash — faqat bitta, oldingisi almashtiriladi
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) {
      showToast(t("mnu.img_too_big"), "error");
      return;
    }
    setImageAsset(asset);
    setImageUrl(null);
  };

  const removeImage = () => {
    setImageAsset(null);
    setImageUrl(null);
  };

  // Matnni uz/ru/en ga tarjima qiladi (xato bo'lsa oddiy matn qaytadi).
  const translate = async (text: string): Promise<unknown> => {
    const clean = text.trim();
    if (!clean) return null;
    try {
      const j = await translateMultilingual(clean);
      if (j && (j.uz || j.ru || j.en)) return j;
    } catch {
      /* tarjima bo'lmasa oddiy matn */
    }
    return clean;
  };

  const save = async () => {
    if (!providerId) return;
    if (!name.trim()) {
      showToast(t("mnu.name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      const nameVal = await translate(name);
      const descVal = description.trim() ? await translate(description) : null;
      const priceNum = price.trim()
        ? Math.max(0, Math.round(Number(price.replace(/\s/g, ""))))
        : 0;

      // Yangi rasm tanlangan bo'lsa — storage'ga yuklab, public URL olamiz
      let imgUrl = imageUrl;
      if (imageAsset) {
        const mime = imageAsset.mimeType || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        const filePath = `${providerId}/${Date.now()}.${ext}`;
        const arraybuffer = await fetch(imageAsset.uri).then((res) => res.arrayBuffer());
        const { error: upErr } = await supabase.storage
          .from("menu-images")
          .upload(filePath, arraybuffer, { contentType: mime, cacheControl: "3600" });
        if (upErr) throw upErr;
        imgUrl = supabase.storage.from("menu-images").getPublicUrl(filePath).data.publicUrl;
      }

      const payload = {
        provider_id: providerId,
        name: nameVal,
        description: descVal,
        price: Number.isFinite(priceNum) ? priceNum : 0,
        image_url: imgUrl,
        is_active: active,
      };

      if (editId) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("menu_items")
          .insert({ ...payload, sort_order: items.length });
        if (error) throw error;
      }
      showToast(t("svc.saved"));
      resetForm();
      await load();
    } catch (e) {
      console.error("menu item save failed:", e);
      showToast(t("svc.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      showToast(t("svc.save_failed"), "error");
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== id));
    showToast(t("svc.deleted"));
  };

  const toggleActive = async (m: MenuItem) => {
    const next = !m.is_active;
    setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from("menu_items").update({ is_active: next }).eq("id", m.id);
    if (error) {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: m.is_active } : x)));
      showToast(t("svc.save_failed"), "error");
    }
  };

  // Kategoriya rejimi aniqlanguncha noto'g'ri bo'lim ko'rinib qolmasin
  if (modeLoading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  // Menyu faqat stol rejimidagi bizneslar uchun
  if (mode !== "table") {
    return (
      <Screen>
        <View style={styles.backRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <View style={{ flex: 1 }}>
            <PageHeader title={t("pv.menu_title")} subtitle="" />
          </View>
        </View>
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title={t("mnu.not_table")}
            desc={t("mnu.not_table_desc")}
          />
        </Card>
      </Screen>
    );
  }

  const formImageUri = imageAsset?.uri || imageUrl;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.backRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader title={t("pv.menu_title")} subtitle={t("pv.menu_sub")} />
        </View>
      </View>

      {!formOpen && <SmallButton label={t("mnu.add")} icon={Plus} onPress={openAdd} />}

      {/* Forma — iOS 26 da shisha panel */}
      {formOpen && (
        <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <UtensilsCrossed size={16} color={colors.primary} />
            <Text style={styles.formTitle}>{editId ? t("svc.edit") : t("mnu.add")}</Text>
          </View>

          <View>
            <Text style={styles.label}>{t("mnu.name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("mnu.name_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("mnu.price")}</Text>
            <TextInput
              value={price}
              onChangeText={(v) => setPrice(v.replace(/[^\d\s]/g, ""))}
              keyboardType="numeric"
              placeholder={t("mnu.price_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          {/* Rasm — faqat bitta */}
          <View>
            <Text style={styles.label}>{t("mnu.image")}</Text>
            {formImageUri ? (
              <View style={styles.imageWrap}>
                <Image source={{ uri: formImageUri }} style={styles.image} contentFit="cover" />
                <Pressable style={styles.imageRemove} onPress={removeImage}>
                  <X size={13} color={colors.onErrorContainer} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.imagePick} onPress={pickImage}>
                <ImagePlus size={20} color={colors.onSurfaceVariant} />
                <Text style={styles.imagePickText}>{t("mnu.image_pick")}</Text>
              </Pressable>
            )}
          </View>

          <View>
            <Text style={styles.label}>{t("mnu.desc")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("mnu.desc_ph")}
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={2}
              style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TogglePill value={active} onToggle={() => setActive(!active)} />
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface }}>
              {t("svc.active")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <SmallButton
              label={t("common.save")}
              icon={Save}
              onPress={save}
              loading={saving}
              style={{ flex: 1 }}
            />
            <SmallButton label={t("common.cancel")} icon={X} variant="outline" onPress={resetForm} />
          </View>
        </GlassSurface>
      )}

      {/* Ro'yxat */}
      {loading ? (
        <Spinner />
      ) : items.length === 0 && !formOpen ? (
        <Card>
          <EmptyState icon={UtensilsCrossed} title={t("mnu.empty")} desc={t("mnu.empty_desc")} />
        </Card>
      ) : (
        items.map((m) => (
          <Card key={m.id} style={[{ padding: 20 }, !m.is_active && { opacity: 0.6 }]}>
            <View style={styles.itemTop}>
              {m.image_url ? (
                <Image source={{ uri: m.image_url }} style={styles.itemImage} contentFit="cover" />
              ) : null}
              <Text style={styles.itemName} numberOfLines={2}>
                {localize(m.name, lang)}
              </Text>
            </View>

            {localize(m.description, lang) ? (
              <Text style={styles.itemDesc} numberOfLines={2}>
                {localize(m.description, lang)}
              </Text>
            ) : null}

            <View style={styles.itemPriceRow}>
              <Text style={styles.itemPrice}>{formatSom(m.price)}</Text>
              {!m.is_active && (
                <View style={styles.hiddenBadge}>
                  <Text style={styles.hiddenBadgeText}>{t("svc.hidden")}</Text>
                </View>
              )}
            </View>

            <View style={styles.itemActions}>
              <SmallButton
                label={t("svc.edit")}
                icon={Pencil}
                variant="outline"
                onPress={() => openEdit(m)}
                style={{ flex: 1 }}
              />
              <Pressable style={styles.iconAction} onPress={() => toggleActive(m)}>
                {m.is_active ? (
                  <EyeOff size={14} color={colors.onSurfaceVariant} />
                ) : (
                  <Eye size={14} color={colors.onSurfaceVariant} />
                )}
              </Pressable>
              {deleteId === m.id ? (
                <Pressable style={styles.deleteConfirm} onPress={() => remove(m.id)}>
                  <Text style={styles.deleteConfirmText}>{t("mnu.delete_q")}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.deleteBtn} onPress={() => setDeleteId(m.id)}>
                  <Trash2 size={14} color={colors.error} />
                </Pressable>
              )}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function MenuScreen() {
  return (
    <BusinessGate>
      <MenuContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  form: {
    borderRadius: radius.xl,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  formFallback: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.4),
  },
  formTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
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

  imageWrap: {
    width: 104,
    height: 104,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  image: { width: "100%", height: "100%" },
  imageRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePick: {
    width: 104,
    height: 104,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePickText: { fontSize: 10, fontWeight: "600", color: colors.onSurfaceVariant },

  itemTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  itemName: { fontWeight: "700", fontSize: 16, color: colors.onSurface, flex: 1 },
  itemDesc: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
  itemPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  itemPrice: { fontSize: 20, fontWeight: "700", color: colors.secondary },
  hiddenBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hiddenBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  iconAction: {
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.errorContainer, 0.5),
  },
  deleteConfirm: {
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
  },
  deleteConfirmText: { fontSize: 11, fontWeight: "700", color: colors.onErrorContainer },
}));
