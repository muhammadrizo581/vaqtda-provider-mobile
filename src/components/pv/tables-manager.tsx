// Restoran stollari / kompyuter klub kompyuterlari boshqaruvi —
// faqat booking_mode="table" kategoriyalarda ko'rinadi.
// variant="table": stol (nomi + sig'imi); variant="computer": kompyuter (nomi + turi).
// "Ko'plab qo'shish": prefiks + raqam oralig'i bilan bir urinishda o'nlab birlik yaratish.
import { Armchair, Layers, Monitor, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useToast } from "@/components/pv/toast";
import {
  Card,
  EmptyState,
  GlassSurface,
  SmallButton,
  Spinner,
  TogglePill,
} from "@/components/pv/ui";
import { alpha, colors, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { useProvider } from "@/context/ProviderContext";
import { supabase } from "@/lib/supabase";

export interface RestaurantTable {
  id: string;
  provider_id: string;
  name: string;
  capacity: number;
  type?: string | null;
  is_active: boolean;
  sort_order: number;
}

// Bir urinishda qo'shiladigan birliklar soni chegarasi
const BULK_MAX = 200;
// Kompyuter turi uchun tez tanlash chiplari
const PC_TYPE_PRESETS = ["Standart", "VIP", "Premium", "PlayStation"];

export function TablesManager({ variant = "table" }: { variant?: "table" | "computer" }) {
  const { t } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const providerId = provider?.id;
  const isPc = variant === "computer";
  // Matnlar variantga qarab: tbl.* (stol) yoki cmp.* (kompyuter)
  const k = (key: string) => t((isPc ? `cmp.${key}` : `tbl.${key}`) as Parameters<typeof t>[0]);
  const UnitIcon = isPc ? Monitor : Armchair;

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [typeVal, setTypeVal] = useState("");
  const [prefix, setPrefix] = useState("");
  const [rangeFrom, setRangeFrom] = useState("1");
  const [rangeTo, setRangeTo] = useState("10");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // DBda "type" ustuni hali bo'lmasa, u holda usiz qayta urinamiz
  const stripType = (obj: Record<string, unknown>) => {
    const { type: _omit, ...rest } = obj;
    void _omit;
    return rest;
  };
  const isTypeColumnError = (err: { message?: string } | null) =>
    !!err && `${err.message}`.includes("'type'");

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setTables((data as RestaurantTable[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setCapacity("4");
    setTypeVal("");
    setMode("single");
    setFormOpen(false);
  };

  const openEdit = (tb: RestaurantTable) => {
    setEditId(tb.id);
    setName(tb.name);
    setCapacity(String(tb.capacity));
    setTypeVal(tb.type || "");
    setMode("single");
    setFormOpen(true);
  };

  const openBulk = () => {
    setEditId(null);
    setPrefix(k("bulk_prefix_default"));
    setRangeFrom("1");
    setRangeTo("10");
    setCapacity("4");
    setTypeVal("");
    setMode("bulk");
    setFormOpen(true);
  };

  // Bulk rejimda yaratiladigan nomlar — mavjudlari bilan to'qnashmasligi uchun ular tashlab ketiladi
  const bulkNames = useMemo(() => {
    if (mode !== "bulk") return [];
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (isNaN(from) || isNaN(to) || to < from) return [];
    const existing = new Set(tables.map((x) => x.name.toLowerCase()));
    const names: string[] = [];
    for (let i = from; i <= to && names.length < BULK_MAX; i++) {
      const nm = `${prefix.trim()} ${i}`.trim();
      if (!existing.has(nm.toLowerCase())) names.push(nm);
    }
    return names;
  }, [mode, prefix, rangeFrom, rangeTo, tables]);

  const save = async () => {
    if (!providerId) return;
    if (!name.trim()) {
      showToast(k("name_required"), "error");
      return;
    }
    setSaving(true);
    try {
      // Kompyuter variantida sig'im so'ralmaydi (1), o'rniga turi saqlanadi
      const cap = isPc ? (editId ? undefined : 1) : Math.max(1, parseInt(capacity, 10) || 1);
      if (editId) {
        const payload: Record<string, unknown> = { name: name.trim() };
        if (cap !== undefined) payload.capacity = cap;
        if (isPc) payload.type = typeVal.trim() || null;
        let { error } = await supabase.from("restaurant_tables").update(payload).eq("id", editId);
        if (isTypeColumnError(error)) {
          ({ error } = await supabase.from("restaurant_tables").update(stripType(payload)).eq("id", editId));
        }
        if (error) throw error;
      } else {
        const payload: Record<string, unknown> = {
          provider_id: providerId,
          name: name.trim(),
          capacity: cap ?? 1,
          sort_order: tables.length,
        };
        if (isPc) payload.type = typeVal.trim() || null;
        let { error } = await supabase.from("restaurant_tables").insert(payload);
        if (isTypeColumnError(error)) {
          ({ error } = await supabase.from("restaurant_tables").insert(stripType(payload)));
        }
        if (error) throw error;
      }
      showToast(t("tbl.saved"));
      resetForm();
      await load();
    } catch {
      showToast(t("tbl.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const bulkSave = async () => {
    if (!providerId) return;
    if (bulkNames.length === 0) {
      showToast(k("bulk_nothing"), "error");
      return;
    }
    setSaving(true);
    try {
      const cap = isPc ? 1 : Math.max(1, parseInt(capacity, 10) || 1);
      const rows = bulkNames.map((nm, i) => {
        const row: Record<string, unknown> = {
          provider_id: providerId,
          name: nm,
          capacity: cap,
          sort_order: tables.length + i,
        };
        if (isPc) row.type = typeVal.trim() || null;
        return row;
      });
      let { error } = await supabase.from("restaurant_tables").insert(rows);
      if (isTypeColumnError(error)) {
        ({ error } = await supabase.from("restaurant_tables").insert(rows.map(stripType)));
      }
      if (error) throw error;
      showToast(`${bulkNames.length} ${k("bulk_added")}`);
      resetForm();
      await load();
    } catch {
      showToast(t("tbl.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) {
      showToast(t("tbl.save_failed"), "error");
      return;
    }
    setTables((prev) => prev.filter((x) => x.id !== id));
    showToast(t("tbl.deleted"));
  };

  const toggleActive = async (tb: RestaurantTable) => {
    const next = !tb.is_active;
    setTables((prev) => prev.map((x) => (x.id === tb.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ is_active: next })
      .eq("id", tb.id);
    if (error) {
      setTables((prev) => prev.map((x) => (x.id === tb.id ? { ...x, is_active: tb.is_active } : x)));
      showToast(t("tbl.save_failed"), "error");
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Sarlavha */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <UnitIcon size={16} color={colors.primary} />
        <Text style={styles.title}>{k("title")}</Text>
      </View>
      <Text style={styles.sub}>{k("sub")}</Text>

      {!formOpen && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SmallButton label={k("add")} icon={Plus} onPress={() => { setMode("single"); setFormOpen(true); }} style={{ flex: 1 }} />
          <SmallButton label={t("tbl.bulk_add")} icon={Layers} variant="outline" onPress={openBulk} style={{ flex: 1 }} />
        </View>
      )}

      {/* Bulk forma — prefiks + raqam oralig'i, masalan Stol 1..50 */}
      {formOpen && mode === "bulk" && (
        <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
          <View>
            <Text style={styles.label}>{t("tbl.bulk_prefix")}</Text>
            <TextInput
              value={prefix}
              onChangeText={setPrefix}
              placeholder={k("bulk_prefix_default")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("tbl.bulk_from")}</Text>
              <TextInput
                value={rangeFrom}
                onChangeText={(v) => setRangeFrom(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("tbl.bulk_to")}</Text>
              <TextInput
                value={rangeTo}
                onChangeText={(v) => setRangeTo(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </View>
          </View>
          {isPc ? (
            <View>
              <Text style={styles.label}>{t("cmp.type")}</Text>
              <TextInput
                value={typeVal}
                onChangeText={setTypeVal}
                placeholder={t("cmp.type_ph")}
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {PC_TYPE_PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setTypeVal(p)}
                    style={[
                      styles.chip,
                      typeVal === p
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: typeVal === p ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>{t("tbl.capacity")}</Text>
              <TextInput
                value={capacity}
                onChangeText={(v) => setCapacity(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor={colors.outline}
                style={[styles.input, { width: 100 }]}
              />
            </View>
          )}

          {/* Oldindan ko'rish */}
          <View style={styles.preview}>
            {bulkNames.length > 0 ? (
              <Text style={styles.previewText}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{bulkNames.length}</Text>{" "}
                {k("bulk_preview")}:{" "}
                <Text style={{ color: colors.onSurface }}>
                  {bulkNames.slice(0, 3).join(", ")}
                  {bulkNames.length > 3 ? ` … ${bulkNames[bulkNames.length - 1]}` : ""}
                </Text>
              </Text>
            ) : (
              <Text style={styles.previewText}>{k("bulk_nothing")}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <SmallButton
              label={k("bulk_create")}
              icon={Layers}
              onPress={bulkSave}
              loading={saving}
              disabled={bulkNames.length === 0}
              style={{ flex: 1 }}
            />
            <SmallButton label={t("common.cancel")} icon={X} variant="outline" onPress={resetForm} />
          </View>
        </GlassSurface>
      )}

      {/* Forma (bitta qo'shish/tahrirlash) */}
      {formOpen && mode === "single" && (
        <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
          <View>
            <Text style={styles.label}>{k("name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={k("name_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>
          {isPc ? (
            <View>
              <Text style={styles.label}>{t("cmp.type")}</Text>
              <TextInput
                value={typeVal}
                onChangeText={setTypeVal}
                placeholder={t("cmp.type_ph")}
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {PC_TYPE_PRESETS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setTypeVal(p)}
                    style={[
                      styles.chip,
                      typeVal === p
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: typeVal === p ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>{t("tbl.capacity")}</Text>
              <TextInput
                value={capacity}
                onChangeText={(v) => setCapacity(v.replace(/[^\d]/g, ""))}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor={colors.outline}
                style={[styles.input, { width: 100 }]}
              />
            </View>
          )}
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
        <Spinner style={{ paddingVertical: 24 }} />
      ) : tables.length === 0 && !formOpen ? (
        <Card>
          <EmptyState icon={UnitIcon} title={k("empty")} desc={k("empty_desc")} />
        </Card>
      ) : (
        tables.map((tb) => (
          <Card key={tb.id} style={[styles.row, !tb.is_active && { opacity: 0.6 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {tb.name}
              </Text>
              <View style={styles.rowMeta}>
                {isPc ? (
                  <>
                    <Monitor size={12} color={colors.onSurfaceVariant} />
                    <Text style={styles.rowMetaText}>{tb.type || t("cmp.type_none")}</Text>
                  </>
                ) : (
                  <>
                    <Users size={12} color={colors.onSurfaceVariant} />
                    <Text style={styles.rowMetaText}>
                      {tb.capacity} {t("tbl.seats")}
                    </Text>
                  </>
                )}
                {!tb.is_active && <Text style={styles.hiddenText}>· {t("tbl.hidden")}</Text>}
              </View>
            </View>
            <TogglePill value={tb.is_active} onToggle={() => toggleActive(tb)} />
            <SmallButton label="" icon={Pencil} variant="outline" onPress={() => openEdit(tb)} />
            {deleteId === tb.id ? (
              <SmallButton label={t("tbl.delete_q")} variant="error" onPress={() => remove(tb.id)} />
            ) : (
              <SmallButton label="" icon={Trash2} variant="error" onPress={() => setDeleteId(tb.id)} />
            )}
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },

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

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "700" },

  preview: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewText: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },

  row: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  rowMetaText: { fontSize: 12, color: colors.onSurfaceVariant },
  hiddenText: { fontSize: 12, color: colors.onSurfaceVariant },
});
