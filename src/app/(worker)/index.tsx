// Usta o'z profilini o'zi to'ldiradi — ism, rasm, mutaxassislik (title), bio, telefon.
// Saqlanganda provider_staff yozuvi yangilanadi va profile_completed = true bo'ladi.
// Pastda "Men bajaradigan xizmatlar" (staff_services) — usta o'ziga xizmat biriktiradi.
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Camera, LogOut } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  ClientAvatar,
  GlassSurface,
  PageHeader,
  SmallButton,
  Spinner,
  TogglePill,
} from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useWorker } from "@/context/WorkerContext";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";

// +998 (XX) XXX XX XX ko'rinishida formatlash
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

export default function WorkerProfileScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { user, logout } = useAuth();
  const { worker, shop, loading, reload } = useWorker();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [localAvatar, setLocalAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  // Mavjud ma'lumotni formaga chiqaramiz (title/bio — jsonb yoki matn)
  useEffect(() => {
    if (!worker) return;
    const timer = setTimeout(() => {
      setFullName(worker.full_name || "");
      setSpecialization(localize(worker.title, lang) || "");
      setBio(localize(worker.bio, lang) || "");
    }, 0);
    return () => clearTimeout(timer);
  }, [worker, lang]);

  // Telefon profiles.phone dan (provider_staff da telefon ustuni yo'q)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
      if (!cancelled && data?.phone) setPhone(data.phone);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    setLocalAvatar(result.assets[0]);
  };

  const save = async () => {
    if (!worker || !user) return;
    if (!fullName.trim()) {
      showToast(t("wk.name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      // Rasm — best-effort (yuklanmasa ham matn saqlanadi)
      let avatarUrl = worker.avatar_url;
      if (localAvatar) {
        try {
          const mime = localAvatar.mimeType || "image/jpeg";
          const ext = mime.split("/")[1] || "jpg";
          const path = `${user.id}/staff-${Date.now()}.${ext}`;
          const arraybuffer = await fetch(localAvatar.uri).then((r) => r.arrayBuffer());
          const { error: upErr } = await supabase.storage
            .from("business_images")
            .upload(path, arraybuffer, { contentType: mime });
          if (upErr) throw upErr;
          avatarUrl = supabase.storage.from("business_images").getPublicUrl(path).data.publicUrl;
        } catch {
          showToast(t("wk.photo_failed"), "error");
        }
      }

      // provider_staff — title/bio matn sifatida (jsonb string; localize o'qiy oladi)
      const { error } = await supabase
        .from("provider_staff")
        .update({
          full_name: fullName.trim(),
          title: specialization.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          profile_completed: true,
        })
        .eq("id", worker.id);
      if (error) throw error;

      // profiles — ism/avatar/telefon (chat va boshqa joylarda ko'rinishi uchun)
      try {
        await supabase
          .from("profiles")
          .update({ full_name: fullName.trim(), avatar_url: avatarUrl, phone: phone.trim() || null })
          .eq("id", user.id);
      } catch {
        /* profiles update RLS bermasa — provider_staff yozuvi baribir saqlandi */
      }

      setLocalAvatar(null);
      showToast(t("wk.profile_saved"));
      await reload();
    } catch {
      showToast(t("wk.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !worker) {
    return (
      <Screen>
        <Spinner style={{ flex: 1 }} />
      </Screen>
    );
  }

  const avatarUri = localAvatar?.uri || worker?.avatar_url || null;
  const shopName = shop ? localize(shop.business_name, lang) : "";

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title={t("wk.my_profile")}
        subtitle={shopName ? `${t("wk.at_shop")}: ${shopName}` : undefined}
        action={
          <Pressable onPress={logout} hitSlop={8} style={styles.logoutBtn}>
            <LogOut size={16} color={colors.error} />
            <Text style={styles.logoutText}>{t("auth.logout")}</Text>
          </Pressable>
        }
      />

      {worker && !worker.profile_completed ? (
        <GlassSurface
          style={styles.promptCard}
          fallbackStyle={styles.promptFallback}
          tintColor={alpha(colors.primaryContainer, 0.25)}
        >
          <Text style={styles.promptText}>{t("wk.profile_prompt")}</Text>
        </GlassSurface>
      ) : null}

      {/* Rasm */}
      <View style={{ alignItems: "center", gap: 10 }}>
        <Pressable onPress={pickPhoto}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <ClientAvatar name={fullName || null} size={96} />
          )}
          <View style={styles.avatarBadge}>
            <Camera size={16} color={colors.onPrimary} />
          </View>
        </Pressable>
        <Text style={styles.pickHint}>{t("wk.pick_photo")}</Text>
      </View>

      <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
        <View>
          <Text style={styles.label}>{t("wk.name")}</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t("wk.name_ph")}
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>{t("wk.specialization")}</Text>
          <TextInput
            value={specialization}
            onChangeText={setSpecialization}
            placeholder={t("wk.specialization_ph")}
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>{t("wk.phone")}</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(formatUzPhone(v))}
            keyboardType="phone-pad"
            placeholder="+998 (90) 123 45 67"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
        </View>

        <View>
          <Text style={styles.label}>{t("wk.bio")}</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder={t("wk.bio_ph")}
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={4}
            style={[styles.input, { minHeight: 96, textAlignVertical: "top" }]}
          />
        </View>
      </GlassSurface>

      <SmallButton
        label={t("wk.save_profile")}
        onPress={save}
        loading={saving}
        style={{ paddingVertical: 14 }}
      />

      {/* Men bajaradigan xizmatlar (staff_services) */}
      {worker ? (
        <StaffServices
          providerId={worker.provider_id}
          staffId={worker.id}
          selfPricing={shop?.staff_sets_own_price === true}
        />
      ) : null}
    </Screen>
  );
}

// ── Usta o'ziga xizmat biriktiradi (staff_services junction) ─────────────────
interface ShopService {
  id: string;
  name: any;
}

function StaffServices({
  providerId,
  staffId,
  selfPricing,
}: {
  providerId: string;
  staffId: string;
  selfPricing: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { showToast } = useToast();

  const [services, setServices] = useState<ShopService[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // service_id → narx matni (bo'sh → do'konning services.price)
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data: svc } = await supabase
        .from("services")
        .select("id, name")
        .eq("provider_id", providerId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const { data: mine } = await supabase
        .from("staff_services")
        .select("service_id, price")
        .eq("staff_id", staffId);
      if (cancelled) return;
      setServices((svc as ShopService[]) || []);
      setSelected(new Set((mine || []).map((r: any) => r.service_id)));
      setPrices(
        Object.fromEntries(
          (mine || [])
            .filter((r: any) => r.price != null)
            .map((r: any) => [r.service_id, String(r.price)])
        )
      );
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [providerId, staffId]);

  const toggle = async (sid: string) => {
    const has = selected.has(sid);
    const prev = selected;
    const next = new Set(selected);
    if (has) next.delete(sid);
    else next.add(sid);
    setSelected(next);
    const { error } = has
      ? await supabase.from("staff_services").delete().eq("staff_id", staffId).eq("service_id", sid)
      : await supabase.from("staff_services").insert({ staff_id: staffId, service_id: sid });
    if (error) {
      setSelected(prev);
      showToast(t("wk.save_failed"), "error");
    } else if (has) {
      // O'chirilganda narxni ham mahalliy tozalaymiz
      setPrices((p) => {
        const n = { ...p };
        delete n[sid];
        return n;
      });
    }
  };

  // Narxni saqlash (onBlur) — bo'sh bo'lsa null (umumiy narx ishlatiladi)
  const savePrice = async (sid: string) => {
    const raw = (prices[sid] || "").replace(/[^0-9]/g, "");
    const value = raw ? Number(raw) : null;
    const { error } = await supabase
      .from("staff_services")
      .update({ price: value })
      .eq("staff_id", staffId)
      .eq("service_id", sid);
    if (error) showToast(t("wk.save_failed"), "error");
  };

  return (
    <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
      <View>
        <Text style={styles.pricesTitle}>{t("wk.my_services")}</Text>
        <Text style={styles.pricesSub}>{t("wk.my_services_sub")}</Text>
        {!selfPricing ? <Text style={styles.pricesSub}>{t("wk.price_by_shop")}</Text> : null}
      </View>

      {loading ? (
        <Spinner style={{ paddingVertical: 12 }} />
      ) : services.length === 0 ? (
        <Text style={styles.pricesSub}>{t("wk.no_services")}</Text>
      ) : (
        services.map((s) => {
          const on = selected.has(s.id);
          return (
            <View key={s.id} style={{ gap: 8 }}>
              <View style={styles.svcRow}>
                <Text style={styles.svcName} numberOfLines={1}>
                  {localize(s.name, lang)}
                </Text>
                <TogglePill value={on} onToggle={() => toggle(s.id)} />
              </View>
              {selfPricing && on ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t("wk.your_price")}</Text>
                  <TextInput
                    value={prices[s.id] || ""}
                    onChangeText={(v) =>
                      setPrices((p) => ({ ...p, [s.id]: v.replace(/[^0-9]/g, "") }))
                    }
                    onBlur={() => savePrice(s.id)}
                    keyboardType="number-pad"
                    placeholder={t("wk.default_price")}
                    placeholderTextColor={colors.outline}
                    style={[styles.input, styles.priceInput]}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </GlassSurface>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    logoutBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    logoutText: { fontSize: 13, fontWeight: "700", color: colors.error },

    promptCard: { borderRadius: radius.lg, padding: 14, overflow: "hidden" },
    promptFallback: {
      backgroundColor: alpha(colors.primaryContainer, 0.18),
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.35),
    },
    promptText: { fontSize: 13, fontWeight: "500", color: colors.onSurface, lineHeight: 18 },

    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.background,
    },
    pickHint: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: "600" },

    card: { borderRadius: radius.xl, padding: 20, gap: 16, overflow: "hidden" },
    cardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    pricesTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
    pricesSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, lineHeight: 16 },
    svcRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    svcName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "500", color: colors.onSurface },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingLeft: 4,
      paddingBottom: 4,
    },
    priceLabel: { fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant },
    priceInput: {
      width: 140,
      paddingVertical: 8,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
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
  })
);
