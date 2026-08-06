// Bo'limlar boshqaruvi (shifoxona/klinika) — services.tsx bilan bir xil tuzilma.
// Bitta shifoxona = bitta provayder; uning ichida bo'limlar (Kardiologiya,
// Urologiya…), bo'lim ichida esa shifokorlar (staff.tsx) va xizmatlar bo'ladi.
// Tarjima /api/translate o'rniga bevosita utils/translate.ts orqali qilinadi.
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
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
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import { translateMultilingual } from "@/utils/translate";

interface Department {
  id: string;
  provider_id: string;
  // jsonb {uz,ru,en} yoki matn — localize() bilan ko'rsatiladi
  name: any;
  description: any;
  is_active: boolean;
  sort_order: number;
}

function DepartmentsContent() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const router = useRouter();
  const providerId = provider?.id || null;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  // Migratsiya hali qo'llanmagan bo'lsa (jadval yo'q) — sahifa xato bermay yopiladi
  const [unavailable, setUnavailable] = useState(false);

  // Form holati
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    // select("*") — ustunlar to'plami o'zgarsa ham xato bermaydi
    const { data, error } = await supabase
      .from("provider_departments")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setUnavailable(!!error);
    setDepartments((data as Department[]) || []);
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
    setDescription("");
    setActive(true);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditId(d.id);
    setName(localize(d.name, lang) || "");
    setDescription(localize(d.description, lang) || "");
    setActive(d.is_active);
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
      showToast(t("dep.name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      const nameVal = await translate(name);
      const descVal = description.trim() ? await translate(description) : null;
      const payload = {
        provider_id: providerId,
        name: nameVal,
        description: descVal,
        is_active: active,
      };

      if (editId) {
        const { error } = await supabase
          .from("provider_departments")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("provider_departments")
          .insert({ ...payload, sort_order: departments.length });
        if (error) throw error;
      }
      showToast(t("svc.saved"));
      resetForm();
      await load();
    } catch (e) {
      console.error("department save failed:", e);
      showToast(t("svc.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("provider_departments").delete().eq("id", id);
    if (error) {
      // 23503 — bo'limga shifokorlar (yoki xizmatlar) bog'langan; baza o'chirishga
      // yo'l qo'ymaydi, aks holda ular "egasiz" qolib ketardi
      const busy = error.code === "23503" || `${error.message}`.includes("violates foreign key");
      showToast(busy ? t("dep.has_staff") : t("svc.save_failed"), "error");
      return;
    }
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    showToast(t("svc.deleted"));
  };

  const toggleActive = async (d: Department) => {
    const next = !d.is_active;
    setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase
      .from("provider_departments")
      .update({ is_active: next })
      .eq("id", d.id);
    if (error) {
      setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: d.is_active } : x)));
      showToast(t("svc.save_failed"), "error");
    }
  };

  // Tartibni almashtirish: qo'shni bilan joyini almashtiramiz va sort_order ni
  // ro'yxatdagi o'rin bilan bir xil qilib normallashtiramiz (0,1,2…).
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= departments.length) return;
    const prev = departments;
    const swapped = [...prev];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    const normalized = swapped.map((d, i) => ({ ...d, sort_order: i }));
    setDepartments(normalized);

    const dirty = normalized.filter(
      (d) => prev.find((p) => p.id === d.id)?.sort_order !== d.sort_order
    );
    const results = await Promise.all(
      dirty.map((d) =>
        supabase.from("provider_departments").update({ sort_order: d.sort_order }).eq("id", d.id)
      )
    );
    if (results.some((r) => r.error)) {
      setDepartments(prev);
      showToast(t("svc.save_failed"), "error");
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.backRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader title={t("dep.title")} subtitle={t("dep.sub")} />
        </View>
      </View>

      {/* Migratsiya qo'llanmagan bo'lsa — forma ko'rsatilmaydi */}
      {unavailable ? (
        <Card>
          <EmptyState
            icon={Building2}
            title={t("dep.unavailable")}
            desc={t("dep.unavailable_desc")}
          />
        </Card>
      ) : (
        <>
          {!formOpen && <SmallButton label={t("dep.add")} icon={Plus} onPress={openAdd} />}

          {/* Forma — iOS 26 da shisha panel */}
          {formOpen && (
            <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Building2 size={16} color={colors.primary} />
                <Text style={styles.formTitle}>{editId ? t("dep.edit") : t("dep.add")}</Text>
              </View>

              <View>
                <Text style={styles.label}>{t("dep.name")}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t("dep.name_ph")}
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
              </View>

              <View>
                <Text style={styles.label}>{t("dep.desc")}</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("dep.desc_ph")}
                  placeholderTextColor={colors.outline}
                  multiline
                  numberOfLines={2}
                  style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TogglePill value={active} onToggle={() => setActive(!active)} />
                <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface }}>
                  {t("dep.active")}
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
                <SmallButton
                  label={t("common.cancel")}
                  icon={X}
                  variant="outline"
                  onPress={resetForm}
                />
              </View>
            </GlassSurface>
          )}

          {/* Ro'yxat */}
          {loading ? (
            <Spinner />
          ) : departments.length === 0 && !formOpen ? (
            <Card>
              <EmptyState icon={Building2} title={t("dep.empty")} desc={t("dep.empty_desc")} />
            </Card>
          ) : (
            departments.map((d, i) => (
              <Card key={d.id} style={[{ padding: 20 }, !d.is_active && { opacity: 0.6 }]}>
                <View style={styles.depTop}>
                  <Text style={styles.depName} numberOfLines={1}>
                    {localize(d.name, lang)}
                  </Text>
                  {/* Tartib o'zgartirish — yuqoriga/pastga */}
                  <View style={styles.orderRow}>
                    <Pressable onPress={() => move(i, -1)} disabled={i === 0}>
                      <GlassSurface
                        style={[styles.orderBtn, i === 0 && { opacity: 0.4 }]}
                        fallbackStyle={styles.orderBtnFallback}
                        interactive
                      >
                        <ChevronUp size={14} color={colors.onSurfaceVariant} />
                      </GlassSurface>
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === departments.length - 1}
                    >
                      <GlassSurface
                        style={[
                          styles.orderBtn,
                          i === departments.length - 1 && { opacity: 0.4 },
                        ]}
                        fallbackStyle={styles.orderBtnFallback}
                        interactive
                      >
                        <ChevronDown size={14} color={colors.onSurfaceVariant} />
                      </GlassSurface>
                    </Pressable>
                  </View>
                </View>

                {localize(d.description, lang) ? (
                  <Text style={styles.depDesc} numberOfLines={2}>
                    {localize(d.description, lang)}
                  </Text>
                ) : null}

                {!d.is_active && (
                  <View style={styles.depBadgeRow}>
                    <View style={styles.hiddenBadge}>
                      <Text style={styles.hiddenBadgeText}>{t("dep.hidden")}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.depActions}>
                  <SmallButton
                    label={t("dep.edit")}
                    icon={Pencil}
                    variant="outline"
                    onPress={() => openEdit(d)}
                    style={{ flex: 1 }}
                  />
                  <Pressable onPress={() => toggleActive(d)}>
                    <GlassSurface
                      style={styles.iconAction}
                      fallbackStyle={styles.iconActionFallback}
                      interactive
                    >
                      {d.is_active ? (
                        <EyeOff size={14} color={colors.onSurfaceVariant} />
                      ) : (
                        <Eye size={14} color={colors.onSurfaceVariant} />
                      )}
                    </GlassSurface>
                  </Pressable>
                  {deleteId === d.id ? (
                    <Pressable onPress={() => remove(d.id)}>
                      <GlassSurface
                        style={styles.deleteConfirm}
                        fallbackStyle={{ backgroundColor: colors.errorContainer }}
                        tintColor={alpha(colors.errorContainer, 0.6)}
                        interactive
                      >
                        <Text style={styles.deleteConfirmText}>{t("dep.delete_q")}</Text>
                      </GlassSurface>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setDeleteId(d.id)}>
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
        </>
      )}
    </Screen>
  );
}

export default function DepartmentsScreen() {
  return (
    <BusinessGate>
      <DepartmentsContent />
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

  depTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  depName: { fontWeight: "700", fontSize: 16, color: colors.onSurface, flex: 1 },
  orderRow: { flexDirection: "row", gap: 6 },
  orderBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orderBtnFallback: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  depDesc: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 },
  depBadgeRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
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
  depActions: {
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
