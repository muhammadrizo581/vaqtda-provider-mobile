// Avtomobil ijarasi (avtopark) boshqaruvi — rental_cars jadvali.
// Faqat avto-ijara kategoriyasida "Boshqa" menyusidan ochiladi.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Car,
  Eye,
  EyeOff,
  Fuel,
  Gauge,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  Card,
  EmptyState,
  GlassIconButton,
  GlassSurface,
  PageHeader,
  SelectPill,
  SmallButton,
  Spinner,
  TogglePill,
} from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { formatSom } from "@/utils/price";

export interface RentalCar {
  id: string;
  provider_id: string;
  brand: string;
  model: string;
  year?: number | null;
  transmission: string;
  fuel_type: string;
  daily_price: number;
  color?: string | null;
  plate_number?: string | null;
  deposit_amount?: number | null;
  images?: string[] | null;
  is_active: boolean;
  sort_order: number;
}

const TRANSMISSION_PRESETS = [
  { id: "automatic", label: "Avtomat" },
  { id: "manual", label: "Mexanika" },
];

const FUEL_PRESETS = [
  { id: "petrol", label: "Benzin" },
  { id: "electric", label: "Elektr" },
  { id: "hybrid", label: "Gibrid" },
  { id: "gas", label: "Gaz" },
];

export default function CarsScreen() {
  return (
    <BusinessGate>
      <CarsContent />
    </BusinessGate>
  );
}

function CarsContent() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { provider } = useProvider();
  const { user } = useAuth();
  const { showToast } = useToast();
  const providerId = provider?.id;

  const [cars, setCars] = useState<RentalCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Forma maydonlari
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [transmission, setTransmission] = useState("automatic");
  const [fuelType, setFuelType] = useState("petrol");
  const [dailyPrice, setDailyPrice] = useState("");
  const [color, setColor] = useState("");
  const [deposit, setDeposit] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rental_cars")
        .select("*")
        .eq("provider_id", providerId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        setCars([]);
      } else {
        setCars((data as RentalCar[]) || []);
      }
    } catch {
      setCars([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetForm = () => {
    setEditId(null);
    setBrand("");
    setModel("");
    setYear(new Date().getFullYear().toString());
    setTransmission("automatic");
    setFuelType("petrol");
    setDailyPrice("");
    setColor("");
    setDeposit("");
    setImageUrl(null);
    setImageAsset(null);
    setActive(true);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (car: RentalCar) => {
    setEditId(car.id);
    setBrand(car.brand);
    setModel(car.model);
    setYear(car.year ? String(car.year) : "");
    setTransmission(car.transmission || "automatic");
    setFuelType(car.fuel_type || "petrol");
    setDailyPrice(car.daily_price ? String(car.daily_price) : "");
    setColor(car.color || "");
    setDeposit(car.deposit_amount ? String(car.deposit_amount) : "");
    setImageUrl(car.images?.[0] || null);
    setImageAsset(null);
    setActive(car.is_active);
    setFormOpen(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    setImageAsset(result.assets[0]);
    setImageUrl(null);
  };

  const save = async () => {
    if (!providerId) return;
    if (!brand.trim() || !model.trim()) {
      showToast("Marka va modelni kiriting", "error");
      return;
    }
    const priceNum = Math.max(0, parseInt(dailyPrice.replace(/[^\d]/g, ""), 10) || 0);
    const yearNum = parseInt(year.replace(/[^\d]/g, ""), 10) || null;
    const depNum = deposit.trim() ? parseInt(deposit.replace(/[^\d]/g, ""), 10) || 0 : 0;

    setSaving(true);
    try {
      let finalImg = imageUrl;
      if (imageAsset) {
        if (!user) throw new Error("Sessiya topilmadi");
        const mime = imageAsset.mimeType || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        // Storage RLS birinchi papka = auth.uid() bo'lishini talab qiladi (business-profile bilan bir xil)
        const filePath = `${user.id}/cars/${Date.now()}.${ext}`;
        const arraybuffer = await fetch(imageAsset.uri).then((res) => res.arrayBuffer());
        const { error: upErr } = await supabase.storage
          .from("business_images")
          .upload(filePath, arraybuffer, { contentType: mime, cacheControl: "3600" });

        // Yuklanmasa jimgina o'tib ketmaymiz — aks holda eski rasm ham yo'qolardi
        if (upErr) throw upErr;
        finalImg = supabase.storage.from("business_images").getPublicUrl(filePath).data.publicUrl;
      }

      const payload = {
        provider_id: providerId,
        brand: brand.trim(),
        model: model.trim(),
        year: yearNum,
        transmission,
        fuel_type: fuelType,
        daily_price: priceNum,
        color: color.trim() || null,
        deposit_amount: depNum,
        images: finalImg ? [finalImg] : [],
        is_active: active,
      };

      if (editId) {
        const { error } = await supabase.from("rental_cars").update(payload).eq("id", editId);
        if (error) throw error;
        showToast("Mashina yangilandi");
      } else {
        const { error } = await supabase
          .from("rental_cars")
          .insert({ ...payload, sort_order: cars.length });
        if (error) throw error;
        showToast("Mashina qo'shildi");
      }

      resetForm();
      await load();
    } catch (err: any) {
      showToast(err?.message || "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    Alert.alert("Mashinani o'chirish", "Haqiqatan ham bu avtomobilni o'chirmoqchimisiz?", [
      { text: t("common.cancel"), style: "cancel", onPress: () => setDeleteId(null) },
      {
        text: "O'chirish",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("rental_cars").delete().eq("id", id);
          if (error) {
            showToast("O'chirishda xatolik", "error");
          } else {
            setCars((prev) => prev.filter((c) => c.id !== id));
            showToast("Avtomobil o'chirildi");
          }
          setDeleteId(null);
        },
      },
    ]);
  };

  const toggleActive = async (car: RentalCar) => {
    const next = !car.is_active;
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, is_active: next } : c)));
    const { error } = await supabase
      .from("rental_cars")
      .update({ is_active: next })
      .eq("id", car.id);
    if (error) {
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, is_active: car.is_active } : c)));
      showToast("Xatolik", "error");
    }
  };

  const currentImgUri = imageAsset?.uri || imageUrl;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader
            title={t("pv.nav_cars")}
            subtitle={t("pv.more_cars_sub")}
          />
        </View>
      </View>

      {!formOpen && (
        <View style={styles.topBtnRow}>
          <SmallButton label="Yangi avto qo'shish" icon={Plus} onPress={openAdd} style={{ flex: 1 }} />
        </View>
      )}

      {formOpen && (
        <GlassSurface style={styles.formCard} fallbackStyle={styles.formCardFallback}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? "Avtomobilni tahrirlash" : "Yangi avtomobil"}</Text>
            <Pressable onPress={resetForm} hitSlop={8}>
              <X size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          {/* Rasm */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Avtomobil rasmi</Text>
            {currentImgUri ? (
              <View style={styles.imageBox}>
                <Image source={{ uri: currentImgUri }} style={styles.imagePreview} contentFit="cover" />
                <Pressable onPress={() => { setImageAsset(null); setImageUrl(null); }} style={styles.imgRemoveBtn}>
                  <X size={14} color="#ffffff" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={pickImage} style={styles.uploadPlaceholder}>
                <ImagePlus size={24} color={colors.primary} />
                <Text style={styles.uploadText}>Rasm yuklash</Text>
              </Pressable>
            )}
          </View>

          {/* Marka va Model */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>Markasi</Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Chevrolet"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1.2, gap: 6 }}>
              <Text style={styles.label}>Modeli</Text>
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="Malibu 2"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
          </View>

          {/* Yil va Rang */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>Ishlab chiqarilgan yili</Text>
              <TextInput
                value={year}
                onChangeText={(v) => setYear(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="2024"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>Rangi</Text>
              <TextInput
                value={color}
                onChangeText={setColor}
                placeholder="Oq, Qora..."
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
          </View>

          {/* Uzatmalar qutisi */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Uzatmalar qutisi</Text>
            <View style={styles.chipRow}>
              {TRANSMISSION_PRESETS.map((p) => (
                <SelectPill
                  key={p.id}
                  label={p.label}
                  active={transmission === p.id}
                  onPress={() => setTransmission(p.id)}
                />
              ))}
            </View>
          </View>

          {/* Yoqilg'i turi */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{"Yoqilg'i turi"}</Text>
            <View style={styles.chipRow}>
              {FUEL_PRESETS.map((p) => (
                <SelectPill
                  key={p.id}
                  label={p.label}
                  active={fuelType === p.id}
                  onPress={() => setFuelType(p.id)}
                />
              ))}
            </View>
          </View>

          {/* Kunlik narx va Garov */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1.2, gap: 6 }}>
              <Text style={styles.label}>{"Kunlik ijara (so'm / kun)"}</Text>
              <TextInput
                value={dailyPrice}
                onChangeText={(v) => setDailyPrice(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="400 000"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>{"Depozit / Garov (so'm)"}</Text>
              <TextInput
                value={deposit}
                onChangeText={(v) => setDeposit(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
          </View>

          {/* Faollik holati */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TogglePill value={active} onToggle={() => setActive(!active)} />
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface }}>
              {t("svc.active")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
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

      {/* Avtomobillar ro'yxati */}
      {loading ? (
        <Spinner style={{ paddingVertical: 32 }} />
      ) : cars.length === 0 && !formOpen ? (
        // Qo'shish tugmasi tepada bor — bo'sh holatda ikkinchisi ortiqcha
        <Card>
          <EmptyState
            icon={Car}
            title="Avtomobillar mavjud emas"
            desc="Ijaraga beriladigan birinchi mashinani qo'shing."
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {cars.map((car) => {
            const transLabel =
              TRANSMISSION_PRESETS.find((p) => p.id === car.transmission)?.label || car.transmission;
            const fuelLabel =
              FUEL_PRESETS.find((p) => p.id === car.fuel_type)?.label || car.fuel_type;
            const img = car.images?.[0];

            return (
              <GlassSurface
                key={car.id}
                style={[styles.carCard, !car.is_active && styles.carCardInactive]}
                fallbackStyle={styles.carCardFallback}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.carThumb} contentFit="cover" />
                ) : (
                  <View style={styles.carThumbPlaceholder}>
                    <Car size={26} color={colors.onSurfaceVariant} />
                  </View>
                )}

                <View style={styles.carContent}>
                  <View style={styles.carTopRow}>
                    <Text style={styles.carTitle} numberOfLines={1}>
                      {car.brand} {car.model}
                    </Text>
                    {car.year ? (
                      <View style={styles.yearBadge}>
                        <Text style={styles.yearBadgeText}>{car.year}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Parametrlar qatori */}
                  <View style={styles.paramsRow}>
                    <View style={styles.paramItem}>
                      <Gauge size={13} color={colors.onSurfaceVariant} />
                      <Text style={styles.paramText}>{transLabel}</Text>
                    </View>
                    <View style={styles.paramItem}>
                      <Fuel size={13} color={colors.onSurfaceVariant} />
                      <Text style={styles.paramText}>{fuelLabel}</Text>
                    </View>
                    {car.color ? (
                      <View style={styles.paramItem}>
                        <Text style={styles.paramText}>{car.color}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.carPrice}>
                      {formatSom(car.daily_price)} <Text style={styles.perDay}>/ kun</Text>
                    </Text>
                    {car.deposit_amount && car.deposit_amount > 0 ? (
                      <Text style={styles.depositText}>Garov: {formatSom(car.deposit_amount)}</Text>
                    ) : null}
                  </View>

                  <View style={styles.carActionsRow}>
                    <Pressable
                      onPress={() => toggleActive(car)}
                      style={[styles.actionBtn, car.is_active ? styles.actionActive : styles.actionInactive]}
                    >
                      {car.is_active ? (
                        <Eye size={14} color={colors.primary} />
                      ) : (
                        <EyeOff size={14} color={colors.onSurfaceVariant} />
                      )}
                      <Text
                        style={[
                          styles.actionBtnText,
                          car.is_active ? { color: colors.primary } : { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {car.is_active ? "Faol" : "Nofaol"}
                      </Text>
                    </Pressable>

                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <GlassIconButton onPress={() => openEdit(car)}>
                        <Pencil size={15} color={colors.onSurfaceVariant} />
                      </GlassIconButton>
                      <GlassIconButton
                        onPress={() => {
                          if (deleteId !== car.id) confirmDelete(car.id);
                        }}
                      >
                        <Trash2 size={15} color={colors.error} />
                      </GlassIconButton>
                    </View>
                  </View>
                </View>
              </GlassSurface>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    topBtnRow: {
      flexDirection: "row",
      marginBottom: 16,
    },
    formCard: {
      padding: 16,
      borderRadius: radius.lg,
      gap: 14,
      marginBottom: 16,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    formCardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    formTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
    },
    input: {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.onSurface,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    imageBox: {
      width: "100%",
      height: 140,
      borderRadius: radius.md,
      overflow: "hidden",
      position: "relative",
    },
    imagePreview: {
      width: "100%",
      height: "100%",
    },
    imgRemoveBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    uploadPlaceholder: {
      height: 90,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: alpha(colors.primary, 0.4),
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: alpha(colors.primary, 0.04),
    },
    uploadText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    carCard: {
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: 0,
    },
    carCardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    carCardInactive: {
      opacity: 0.65,
    },
    carThumb: {
      width: "100%",
      height: 140,
    },
    carThumbPlaceholder: {
      width: "100%",
      height: 80,
      backgroundColor: alpha(colors.onSurface, 0.05),
      alignItems: "center",
      justifyContent: "center",
    },
    carContent: {
      padding: 14,
      gap: 8,
    },
    carTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    carTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
      flex: 1,
      marginRight: 8,
    },
    yearBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: alpha(colors.primary, 0.12),
    },
    yearBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    paramsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    paramItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    paramText: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    carPrice: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onSurface,
    },
    perDay: {
      fontSize: 11,
      fontWeight: "400",
      color: colors.onSurfaceVariant,
    },
    depositText: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
    },
    carActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    actionActive: {
      backgroundColor: alpha(colors.primary, 0.1),
    },
    actionInactive: {
      backgroundColor: alpha(colors.onSurface, 0.06),
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "600",
    },
  })
);
