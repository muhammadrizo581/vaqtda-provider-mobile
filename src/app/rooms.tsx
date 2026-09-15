// Mehmonxona xonalari va kunlik uylar — hotel_rooms jadvali.
// Bitta ekran, kategoriyaga qarab ikki rejim:
//   mehmonxona       — xona + xona turi (turlarni provayder o'zi yaratadi)
//   kvartira / dacha — uy (masalan "Kvartira Chilonzor"), turi yo'q
// Ikkalasida ham xizmat tushunchasi yo'q: narx kunlik va majburiy, ko'pi bilan 5 ta rasm.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Home,
  Hotel,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { useBookingMode } from "@/hooks/useBookingMode";
import { supabase } from "@/lib/supabase";
import { formatSom } from "@/utils/price";

export interface HotelRoom {
  id: string;
  provider_id: string;
  name: string;
  room_type: string;
  capacity: number;
  price_per_night: number;
  description: string | null;
  amenities?: string[] | null;
  images?: string[] | null;
  is_active: boolean;
  sort_order: number;
}

const MAX_PHOTOS = 5;
// Uylarda tur tanlanmaydi — room_type NOT NULL bo'lgani uchun shu qiymat yoziladi
const HOUSE_TYPE = "house";
// Avval qattiq kodlangan turlar bazada id bilan saqlangan — nomi bilan ko'rsatamiz
const LEGACY_TYPE_LABELS: Record<string, string> = {
  standard: "Standart",
  comfort: "Komfort",
  deluxe: "Lyuks",
  suite: "Suite",
  family: "Oilaviy",
};
const typeLabel = (v: string) => LEGACY_TYPE_LABELS[v] || v;

// Forma rasmi: avval yuklangan (faqat uri) yoki yangi tanlangan (asset bilan)
interface Photo {
  uri: string;
  asset?: ImagePicker.ImagePickerAsset;
}

export default function RoomsScreen() {
  return (
    <BusinessGate>
      <RoomsContent />
    </BusinessGate>
  );
}

function RoomsContent() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { provider } = useProvider();
  const { user } = useAuth();
  const { categorySlug } = useBookingMode();
  const { showToast } = useToast();
  const providerId = provider?.id;
  const isHouse = categorySlug === "kvartira" || categorySlug === "dacha";
  const UnitIcon = isHouse ? Home : Hotel;

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Forma maydonlari
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Yaratilgan, lekin hali hech bir xonaga berilmagan turlar
  const [newTypes, setNewTypes] = useState<string[]>([]);
  // null — tur yaratish maydoni yopiq
  const [typeDraft, setTypeDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hotel_rooms")
        .select("*")
        .eq("provider_id", providerId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        // Jadval hali yaratilmagan bo'lsa yoki bo'sh bo'lsa
        setRooms([]);
      } else {
        setRooms((data as HotelRoom[]) || []);
      }
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Provayderning turlari — xonalardagi mavjud turlar + shu yerda yaratilganlari
  const roomTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) if (r.room_type && r.room_type !== HOUSE_TYPE) set.add(r.room_type);
    for (const nt of newTypes) set.add(nt);
    return [...set];
  }, [rooms, newTypes]);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setRoomType("");
    setCapacity("2");
    setPrice("");
    setDescription("");
    setPhotos([]);
    setActive(true);
    setTypeDraft(null);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (room: HotelRoom) => {
    setEditId(room.id);
    setName(room.name);
    setRoomType(room.room_type === HOUSE_TYPE ? "" : room.room_type || "");
    setCapacity(String(room.capacity || 2));
    setPrice(room.price_per_night ? String(room.price_per_night) : "");
    setDescription(room.description || "");
    setPhotos((room.images || []).slice(0, MAX_PHOTOS).map((uri) => ({ uri })));
    setActive(room.is_active);
    setTypeDraft(null);
    setFormOpen(true);
  };

  const addType = () => {
    const v = (typeDraft || "").trim();
    setTypeDraft(null);
    if (!v) return;
    // Katta-kichik harf farqi bilan dublikat tur yaratilmasin
    const existing = roomTypes.find((x) => typeLabel(x).toLowerCase() === v.toLowerCase());
    if (existing) {
      setRoomType(existing);
    } else {
      setNewTypes((prev) => [...prev, v]);
      setRoomType(v);
    }
  };

  const pickImages = async () => {
    const left = MAX_PHOTOS - photos.length;
    if (left <= 0) {
      showToast(t("rm.max_photos", { max: MAX_PHOTOS }), "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: left,
      quality: 0.8,
    });
    if (result.canceled) return;
    setPhotos((prev) =>
      [...prev, ...result.assets.map((a) => ({ uri: a.uri, asset: a }))].slice(0, MAX_PHOTOS)
    );
  };

  const save = async () => {
    if (!providerId) return;
    if (!name.trim()) {
      showToast(t("rm.err_name"), "error");
      return;
    }
    if (!isHouse && !roomType) {
      showToast(t("rm.err_type"), "error");
      return;
    }
    const capNum = Math.max(1, parseInt(capacity, 10) || 1);
    const priceNum = Math.max(0, parseInt(price.replace(/[^\d]/g, ""), 10) || 0);
    // Bron faqat kunlik — narxsiz xona/uy bo'lmaydi
    if (priceNum <= 0) {
      showToast(t("rm.err_price"), "error");
      return;
    }

    setSaving(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.asset) {
          urls.push(p.uri);
          continue;
        }
        if (!user) throw new Error(t("rm.no_session"));
        const mime = p.asset.mimeType || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        // Storage RLS birinchi papka = auth.uid() bo'lishini talab qiladi (business-profile bilan bir xil)
        const filePath = `${user.id}/rooms/${Date.now()}-${i}.${ext}`;
        const arraybuffer = await fetch(p.asset.uri).then((res) => res.arrayBuffer());
        const { error: upErr } = await supabase.storage
          .from("business_images")
          .upload(filePath, arraybuffer, { contentType: mime, cacheControl: "3600" });

        // Yuklanmasa jimgina o'tib ketmaymiz — aks holda eski rasm ham yo'qolardi
        if (upErr) throw upErr;
        urls.push(supabase.storage.from("business_images").getPublicUrl(filePath).data.publicUrl);
      }

      const payload = {
        provider_id: providerId,
        name: name.trim(),
        room_type: isHouse ? HOUSE_TYPE : roomType,
        capacity: capNum,
        price_per_night: priceNum,
        description: description.trim() || null,
        images: urls,
        is_active: active,
      };

      if (editId) {
        const { error } = await supabase.from("hotel_rooms").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("hotel_rooms")
          .insert({ ...payload, sort_order: rooms.length });
        if (error) throw error;
      }
      showToast(t("rm.saved"));

      resetForm();
      await load();
    } catch (err: any) {
      showToast(err?.message || t("rm.save_error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    Alert.alert(isHouse ? t("rm.delete_house") : t("rm.delete_room"), t("rm.delete_confirm"), [
      { text: t("common.cancel"), style: "cancel", onPress: () => setDeleteId(null) },
      {
        text: t("rm.delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("hotel_rooms").delete().eq("id", id);
          if (error) {
            showToast(t("rm.delete_error"), "error");
          } else {
            setRooms((prev) => prev.filter((r) => r.id !== id));
            showToast(t("rm.deleted"));
          }
          setDeleteId(null);
        },
      },
    ]);
  };

  const toggleActive = async (room: HotelRoom) => {
    const next = !room.is_active;
    setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, is_active: next } : r)));
    const { error } = await supabase
      .from("hotel_rooms")
      .update({ is_active: next })
      .eq("id", room.id);
    if (error) {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, is_active: room.is_active } : r)));
      showToast(t("rm.error"), "error");
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader
            title={isHouse ? t("pv.nav_houses") : t("pv.nav_rooms")}
            subtitle={isHouse ? t("pv.more_houses_sub") : t("pv.more_rooms_sub")}
          />
        </View>
      </View>

      {!formOpen && (
        <View style={styles.topBtnRow}>
          <SmallButton
            label={isHouse ? t("rm.add_house") : t("rm.add_room")}
            icon={Plus}
            onPress={openAdd}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {formOpen && (
        <GlassSurface style={styles.formCard} fallbackStyle={styles.formCardFallback}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editId
                ? isHouse ? t("rm.edit_house") : t("rm.edit_room")
                : isHouse ? t("rm.new_house") : t("rm.new_room")}
            </Text>
            <Pressable onPress={resetForm} hitSlop={8}>
              <X size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          {/* Rasmlar — ko'pi bilan 5 ta */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t("rm.photos", { n: photos.length, max: MAX_PHOTOS })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.imagePreview} contentFit="cover" />
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    style={styles.imgRemoveBtn}
                    hitSlop={6}
                  >
                    <X size={12} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable onPress={pickImages} style={styles.photoAdd}>
                  <ImagePlus size={20} color={colors.primary} />
                  <Text style={styles.uploadText}>{t("rm.add_photo")}</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>

          {/* Nomi */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{isHouse ? t("rm.name_house") : t("rm.name_room")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isHouse ? t("rm.name_house_ph") : t("rm.name_room_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          {/* Xona turi — faqat mehmonxonada; turlarni provayder o'zi yaratadi */}
          {!isHouse && (
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>{t("rm.type")}</Text>
              <View style={styles.chipRow}>
                {roomTypes.map((rt) => (
                  <SelectPill
                    key={rt}
                    label={typeLabel(rt)}
                    active={roomType === rt}
                    onPress={() => setRoomType(rt)}
                  />
                ))}
                {typeDraft === null && (
                  <Pressable onPress={() => setTypeDraft("")} style={styles.addTypeChip}>
                    <Plus size={14} color={colors.primary} />
                    <Text style={styles.addTypeText}>{t("rm.type_add")}</Text>
                  </Pressable>
                )}
              </View>
              {typeDraft !== null && (
                <View style={styles.typeInputRow}>
                  <TextInput
                    value={typeDraft}
                    onChangeText={setTypeDraft}
                    placeholder={t("rm.type_ph")}
                    placeholderTextColor={colors.outline}
                    style={[styles.input, { flex: 1 }]}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={addType}
                  />
                  <GlassIconButton onPress={addType}>
                    <Check size={16} color={colors.primary} />
                  </GlassIconButton>
                  <GlassIconButton onPress={() => setTypeDraft(null)}>
                    <X size={16} color={colors.onSurfaceVariant} />
                  </GlassIconButton>
                </View>
              )}
            </View>
          )}

          {/* Sig'im va kunlik narx */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>{t("rm.capacity")}</Text>
              <TextInput
                value={capacity}
                onChangeText={(v) => setCapacity(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1.5, gap: 6 }}>
              <Text style={styles.label}>{t("rm.price")}</Text>
              <TextInput
                value={price}
                onChangeText={(v) => setPrice(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="350 000"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
          </View>

          {/* Tavsif */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t("rm.desc")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("rm.desc_ph")}
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={3}
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
            />
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

      {/* Ro'yxat. Qo'shish tugmasi tepada bor — bo'sh holatda ikkinchisi ortiqcha */}
      {loading ? (
        <Spinner style={{ paddingVertical: 32 }} />
      ) : rooms.length === 0 && !formOpen ? (
        <Card>
          <EmptyState
            icon={UnitIcon}
            title={isHouse ? t("rm.empty_houses") : t("rm.empty_rooms")}
            desc={isHouse ? t("rm.empty_houses_desc") : t("rm.empty_rooms_desc")}
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {rooms.map((room) => {
            const imgs = room.images || [];
            const showType = !isHouse && room.room_type && room.room_type !== HOUSE_TYPE;

            return (
              <GlassSurface
                key={room.id}
                style={[styles.roomCard, !room.is_active && styles.roomCardInactive]}
                fallbackStyle={styles.roomCardFallback}
              >
                {imgs[0] ? (
                  <View>
                    <Image source={{ uri: imgs[0] }} style={styles.roomThumb} contentFit="cover" />
                    {imgs.length > 1 ? (
                      <View style={styles.countBadge}>
                        <ImagePlus size={11} color="#ffffff" />
                        <Text style={styles.countBadgeText}>{imgs.length}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.roomThumbPlaceholder}>
                    <UnitIcon size={24} color={colors.onSurfaceVariant} />
                  </View>
                )}

                <View style={styles.roomContent}>
                  <View style={styles.roomTopRow}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {room.name}
                    </Text>
                    {showType ? (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{typeLabel(room.room_type)}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.roomDetailsRow}>
                    <View style={styles.capacityWrap}>
                      <Users size={13} color={colors.onSurfaceVariant} />
                      <Text style={styles.capacityText}>{t("rm.people", { n: room.capacity })}</Text>
                    </View>
                    <Text style={styles.roomPrice}>
                      {formatSom(room.price_per_night)} <Text style={styles.perNight}>{t("rm.per_day")}</Text>
                    </Text>
                  </View>

                  {room.description ? (
                    <Text style={styles.roomDesc} numberOfLines={2}>
                      {room.description}
                    </Text>
                  ) : null}

                  <View style={styles.roomActionsRow}>
                    <Pressable
                      onPress={() => toggleActive(room)}
                      style={[styles.actionBtn, room.is_active ? styles.actionActive : styles.actionInactive]}
                    >
                      {room.is_active ? (
                        <Eye size={14} color={colors.primary} />
                      ) : (
                        <EyeOff size={14} color={colors.onSurfaceVariant} />
                      )}
                      <Text
                        style={[
                          styles.actionBtnText,
                          room.is_active ? { color: colors.primary } : { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {room.is_active ? t("svc.active") : t("rm.inactive")}
                      </Text>
                    </Pressable>

                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <GlassIconButton onPress={() => openEdit(room)}>
                        <Pencil size={15} color={colors.onSurfaceVariant} />
                      </GlassIconButton>
                      <GlassIconButton
                        onPress={() => {
                          if (deleteId !== room.id) confirmDelete(room.id);
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
    addTypeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: alpha(colors.primary, 0.5),
    },
    addTypeText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },
    typeInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    photoRow: {
      gap: 8,
      paddingRight: 4,
    },
    photoThumb: {
      width: 84,
      height: 84,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    photoAdd: {
      width: 84,
      height: 84,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: alpha(colors.primary, 0.4),
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: alpha(colors.primary, 0.04),
    },
    imagePreview: {
      width: "100%",
      height: "100%",
    },
    imgRemoveBtn: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    uploadText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    roomCard: {
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: 0,
    },
    roomCardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    roomCardInactive: {
      opacity: 0.65,
    },
    roomThumb: {
      width: "100%",
      height: 140,
    },
    countBadge: {
      position: "absolute",
      right: 8,
      bottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#ffffff",
    },
    roomThumbPlaceholder: {
      width: "100%",
      height: 80,
      backgroundColor: alpha(colors.onSurface, 0.05),
      alignItems: "center",
      justifyContent: "center",
    },
    roomContent: {
      padding: 14,
      gap: 8,
    },
    roomTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    roomName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
      flex: 1,
      marginRight: 8,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: alpha(colors.primary, 0.12),
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    roomDetailsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    capacityWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    capacityText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.onSurfaceVariant,
    },
    roomPrice: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onSurface,
    },
    perNight: {
      fontSize: 11,
      fontWeight: "400",
      color: colors.onSurfaceVariant,
    },
    roomDesc: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      lineHeight: 16,
    },
    roomActionsRow: {
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
