// Xizmatlar boshqaruvi — saytdagi app/dashboard/services/page.tsx dan port.
// Tarjima /api/translate o'rniga bevosita utils/translate.ts orqali qilinadi.
import { useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Clock, Eye, EyeOff, Pencil, Plus, Save, Tag, Trash2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { TablesManager } from "@/components/pv/tables-manager";
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
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProvider } from "@/context/ProviderContext";
import { useBookingMode } from "@/hooks/useBookingMode";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { formatSom } from "@/utils/price";
import { translateMultilingual } from "@/utils/translate";

interface Service {
  id: string;
  provider_id: string;
  // jsonb {uz,ru,en} yoki matn — localize() bilan ko'rsatiladi
  name: any;
  description: any;
  price: number | null;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
}

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];

function ServicesContent() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const router = useRouter();
  const { mode, unit, loading: modeLoading } = useBookingMode();
  const providerId = provider?.id || null;
  // daily (dacha/villa) — narx kunlik, davomiylik so'ralmaydi, xizmatlar ixtiyoriy
  const daily = mode === "daily";
  // table (restoran, kompyuter klub) — xizmat tushunchasi yo'q, faqat stollar/kompyuterlar
  const tableMode = mode === "table";

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Form holati
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setServices((data as Service[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setPrice("");
    setDuration(30);
    setCustomDuration("");
    setDescription("");
    setActive(true);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditId(s.id);
    setName(localize(s.name, lang) || "");
    setPrice(s.price != null ? String(s.price) : "");
    setDuration(s.duration_minutes || 30);
    setCustomDuration(DURATION_PRESETS.includes(s.duration_minutes) ? "" : String(s.duration_minutes));
    setDescription(localize(s.description, lang) || "");
    setActive(s.is_active);
    setFormOpen(true);
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
      showToast(t("svc.name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      const nameVal = await translate(name);
      const descVal = description.trim() ? await translate(description) : null;
      const priceNum = price.trim()
        ? Math.max(0, Math.round(Number(price.replace(/\s/g, ""))))
        : null;
      const payload = {
        provider_id: providerId,
        name: nameVal,
        description: descVal,
        price: Number.isFinite(priceNum as number) ? priceNum : null,
        // Kunlik rejimda davomiylik 1 kun (1440 daqiqa) qilib belgilanadi
        duration_minutes: daily ? 1440 : Math.max(5, duration),
        is_active: active,
      };

      if (editId) {
        const { error } = await supabase.from("services").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert({ ...payload, sort_order: services.length });
        if (error) throw error;
      }
      showToast(t("svc.saved"));
      resetForm();
      await load();
    } catch (e) {
      console.error("service save failed:", e);
      showToast(t("svc.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      showToast(t("svc.save_failed"), "error");
      return;
    }
    setServices((prev) => prev.filter((s) => s.id !== id));
    showToast(t("svc.deleted"));
  };

  const toggleActive = async (s: Service) => {
    const next = !s.is_active;
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from("services").update({ is_active: next }).eq("id", s.id);
    if (error) {
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: s.is_active } : x)));
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

  // Restoran / kompyuter klub: xizmat tushunchasi yo'q — sahifa faqat stollar/kompyuterlardan iborat
  if (tableMode) {
    const pc = unit === "computer";
    return (
      <Screen refreshing={loading} onRefresh={load}>
        <View style={styles.backRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <View style={{ flex: 1 }}>
            <PageHeader
              title={t(pc ? "pv.computers_title" : "pv.tables_title")}
              subtitle={t(pc ? "pv.computers_sub" : "pv.tables_sub")}
            />
          </View>
        </View>
        <TablesManager variant={unit} />
      </Screen>
    );
  }

  const noActive = !loading && !services.some((s) => s.is_active);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.backRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader
            title={t("pv.services_title")}
            subtitle={daily ? t("pv.services_sub_daily") : t("pv.services_sub")}
          />
        </View>
      </View>

      {/* Slots rejimida xizmat majburiy — faol xizmat bo'lmasa ogohlantirish */}
      {!daily && noActive && (
        <GlassSurface
          style={styles.warnBanner}
          fallbackStyle={styles.warnBannerFallback}
          tintColor={alpha(colors.errorContainer, 0.35)}
        >
          <AlertCircle size={15} color={colors.error} />
          <Text style={styles.warnText}>{t("svc.required_warn")}</Text>
        </GlassSurface>
      )}

      {!formOpen && (
        <SmallButton label={t("svc.add")} icon={Plus} onPress={openAdd} />
      )}

      {/* Forma — iOS 26 da shisha panel */}
      {formOpen && (
        <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Tag size={16} color={colors.primary} />
            <Text style={styles.formTitle}>{editId ? t("svc.edit") : t("svc.add")}</Text>
          </View>

          <View>
            <Text style={styles.label}>{t("svc.name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("svc.name_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("svc.price")}</Text>
            <TextInput
              value={price}
              onChangeText={(v) => setPrice(v.replace(/[^\d\s]/g, ""))}
              keyboardType="numeric"
              placeholder={t("svc.price_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <Text style={styles.hint}>{daily ? t("svc.price_daily_hint") : t("svc.price_hint")}</Text>
          </View>

          {/* Kunlik rejimda davomiylik so'ralmaydi — har doim 1 kun */}
          {!daily && (
          <View>
            <Text style={styles.label}>{t("svc.duration")}</Text>
            <View style={styles.durationRow}>
              {DURATION_PRESETS.map((d) => (
                <SelectPill
                  key={d}
                  label={String(d)}
                  active={duration === d && !customDuration}
                  onPress={() => {
                    setDuration(d);
                    setCustomDuration("");
                  }}
                />
              ))}
              <TextInput
                value={customDuration}
                onChangeText={(v) => {
                  const clean = v.replace(/[^\d]/g, "");
                  setCustomDuration(clean);
                  if (clean) setDuration(Math.max(5, parseInt(clean, 10) || 5));
                }}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.outline}
                style={[styles.input, styles.durationInput]}
              />
            </View>
          </View>
          )}

          <View>
            <Text style={styles.label}>{t("svc.desc")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("svc.desc_ph")}
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
      ) : services.length === 0 && !formOpen ? (
        <Card>
          <EmptyState
            icon={Tag}
            title={t("svc.empty")}
            desc={daily ? t("svc.empty_daily_desc") : t("svc.empty_desc")}
          />
        </Card>
      ) : (
        services.map((s) => (
          <Card key={s.id} style={[{ padding: 20 }, !s.is_active && { opacity: 0.6 }]}>
            <View style={styles.svcTop}>
              <Text style={styles.svcName} numberOfLines={1}>
                {localize(s.name, lang)}
              </Text>
              <View style={styles.svcDuration}>
                <Clock size={12} color={colors.onSurfaceVariant} />
                <Text style={styles.svcDurationText}>
                  {daily ? t("svc.per_day") : `${s.duration_minutes} ${t("common.min")}`}
                </Text>
              </View>
            </View>

            {localize(s.description, lang) ? (
              <Text style={styles.svcDesc} numberOfLines={2}>
                {localize(s.description, lang)}
              </Text>
            ) : null}

            <View style={styles.svcPriceRow}>
              <Text style={styles.svcPrice}>
                {s.price != null ? formatSom(s.price) : t("svc.free_price")}
              </Text>
              {!s.is_active && (
                <View style={styles.hiddenBadge}>
                  <Text style={styles.hiddenBadgeText}>{t("svc.hidden")}</Text>
                </View>
              )}
            </View>

            <View style={styles.svcActions}>
              <SmallButton
                label={t("svc.edit")}
                icon={Pencil}
                variant="outline"
                onPress={() => openEdit(s)}
                style={{ flex: 1 }}
              />
              <Pressable onPress={() => toggleActive(s)}>
                <GlassSurface style={styles.iconAction} fallbackStyle={styles.iconActionFallback} interactive>
                  {s.is_active ? (
                    <EyeOff size={14} color={colors.onSurfaceVariant} />
                  ) : (
                    <Eye size={14} color={colors.onSurfaceVariant} />
                  )}
                </GlassSurface>
              </Pressable>
              {deleteId === s.id ? (
                <Pressable onPress={() => remove(s.id)}>
                  <GlassSurface
                    style={styles.deleteConfirm}
                    fallbackStyle={{ backgroundColor: colors.errorContainer }}
                    tintColor={alpha(colors.errorContainer, 0.6)}
                    interactive
                  >
                    <Text style={styles.deleteConfirmText}>{t("svc.delete_q")}</Text>
                  </GlassSurface>
                </Pressable>
              ) : (
                <Pressable onPress={() => setDeleteId(s.id)}>
                  <GlassSurface
                    style={styles.deleteBtn}
                    fallbackStyle={styles.deleteBtnFallback}
                    tintColor={alpha(colors.errorContainer, 0.3)}
                    interactive
                  >
                    <Trash2 size={14} color={colors.error} />
                  </GlassSurface>
                </Pressable>
              )}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function ServicesScreen() {
  return (
    <BusinessGate>
      <ServicesContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  warnBannerFallback: {
    backgroundColor: alpha(colors.errorContainer, 0.2),
    borderWidth: 1,
    borderColor: alpha(colors.error, 0.4),
  },
  warnText: { flex: 1, fontSize: 13, fontWeight: "500", color: colors.onSurface, lineHeight: 18 },

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
  hint: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  durationInput: { width: 72, paddingVertical: 8, fontSize: 12, fontWeight: "700" },

  svcTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  svcName: { fontWeight: "700", fontSize: 16, color: colors.onSurface, flex: 1 },
  svcDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  svcDurationText: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceVariant },
  svcDesc: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
  svcPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  svcPrice: { fontSize: 20, fontWeight: "700", color: colors.secondary },
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
  svcActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  iconAction: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  iconActionFallback: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  deleteBtn: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  deleteBtnFallback: {
    borderWidth: 1,
    borderColor: alpha(colors.errorContainer, 0.5),
  },
  deleteConfirm: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  deleteConfirmText: { fontSize: 11, fontWeight: "700", color: colors.onErrorContainer },
}));
