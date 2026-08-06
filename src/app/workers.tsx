// Ustalar (staff) boshqaruvi — faqat categories.uses_staff kategoriyalarda (sartaroshxona).
// Baza jadvali: provider_staff. Owner ustaga LOGIN + PAROL yaratadi (create-worker
// Edge Function -> provider_staff). Usta shu login bilan kirib, o'z profilini
// (ism/rasm/mutaxassislik/bio/telefon) o'zi to'ldiradi.
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Clock,
  KeyRound,
  Save,
  Share2,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { useToast } from "@/components/pv/toast";
import {
  Card,
  ClientAvatar,
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

interface Staff {
  id: string;
  provider_id: string;
  user_id: string | null;
  full_name: string;
  title: any; // jsonb {uz,ru,en} yoki matn — mutaxassislik
  avatar_url: string | null;
  is_active: boolean;
  schedule_self_managed: boolean;
  profile_completed: boolean;
  sort_order: number;
}

// Chalkash belgilarsiz (O/0, l/1) o'qsa bo'ladigan parol
const PW_CHARS = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
function genPassword(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  return s;
}
// Ismdan login taklifi (lotin, kichik harf, _ bilan)
function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function WorkersContent() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { provider, reload: reloadProvider } = useProvider();
  const { hasWorkers, loading: modeLoading } = useBookingMode();
  const { showToast } = useToast();
  const router = useRouter();
  const providerId = provider?.id || null;

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Qo'shish formasi
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Yaratilgandan keyin ko'rsatiladigan login/parol
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Owner tugmasi: ustalar o'z narxini belgilaydimi (providers.staff_sets_own_price)
  const [selfPricing, setSelfPricing] = useState(false);
  useEffect(() => {
    setSelfPricing(provider?.staff_sets_own_price === true);
  }, [provider?.staff_sets_own_price]);

  const toggleSelfPricing = async () => {
    if (!providerId) return;
    const next = !selfPricing;
    setSelfPricing(next); // optimistik
    const { error } = await supabase
      .from("providers")
      .update({ staff_sets_own_price: next })
      .eq("id", providerId);
    if (error) {
      setSelfPricing(!next);
      showToast(t("wk.save_failed"), "error");
    } else {
      await reloadProvider();
    }
  };

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("provider_staff")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setStaff((data as Staff[]) || []);
    setLoading(false);
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetForm = () => {
    setName("");
    setUsername("");
    setUsernameEdited(false);
    setPassword("");
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setPassword(genPassword());
    setFormOpen(true);
  };

  // Ism yozilganda login taklifini avtomatik to'ldiramiz (owner o'zgartirmagan bo'lsa)
  const onNameChange = (v: string) => {
    setName(v);
    if (!usernameEdited) setUsername(suggestUsername(v));
  };

  const create = async () => {
    if (!providerId) return;
    if (!name.trim()) {
      showToast(t("wk.name_required"), "error");
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
      showToast(t("wk.username_invalid"), "error");
      return;
    }
    if (password.length < 6) {
      showToast(t("wk.password_short"), "error");
      return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("create-worker", {
        body: { username: uname, password, full_name: name.trim() },
      });
      if (res.error) {
        // Xato kodi javob tanasida keladi ({error:"username_taken"} kabi)
        let code = "";
        try {
          const body = await (res.error as { context?: Response }).context?.json();
          code = body?.error || "";
        } catch {}
        const msg =
          code === "username_taken"
            ? t("wk.username_taken")
            : code === "invalid_username"
              ? t("wk.username_invalid")
              : code === "password_short"
                ? t("wk.password_short")
                : code === "not_owner"
                  ? t("wk.not_owner")
                  : t("wk.create_failed");
        showToast(msg, "error");
        setCreating(false);
        return;
      }
      // Muvaffaqiyat — login/parolni ownerga ko'rsatamiz
      setCredentials({ username: uname, password });
      resetForm();
      await load();
    } catch {
      showToast(t("wk.create_failed"), "error");
    } finally {
      setCreating(false);
    }
  };

  const shareCredentials = async () => {
    if (!credentials) return;
    const shopName = provider ? localize(provider.business_name, lang) : "";
    const msg = `${shopName ? shopName + "\n" : ""}Vaqtda — usta kirishi\n${t("wk.credentials_login")}: ${credentials.username}\n${t("wk.credentials_password")}: ${credentials.password}`;
    try {
      await Share.share({ message: msg });
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  };

  const toggleActive = async (w: Staff) => {
    const next = !w.is_active;
    setStaff((prev) => prev.map((x) => (x.id === w.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from("provider_staff").update({ is_active: next }).eq("id", w.id);
    if (error) {
      setStaff((prev) => prev.map((x) => (x.id === w.id ? { ...x, is_active: w.is_active } : x)));
      showToast(t("wk.save_failed"), "error");
    }
  };

  const toggleSelfSchedule = async (w: Staff) => {
    const next = !w.schedule_self_managed;
    setStaff((prev) => prev.map((x) => (x.id === w.id ? { ...x, schedule_self_managed: next } : x)));
    const { error } = await supabase
      .from("provider_staff")
      .update({ schedule_self_managed: next })
      .eq("id", w.id);
    if (error) {
      setStaff((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, schedule_self_managed: w.schedule_self_managed } : x))
      );
      showToast(t("wk.save_failed"), "error");
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("provider_staff").delete().eq("id", id);
    if (error) {
      showToast(t("wk.save_failed"), "error");
      return;
    }
    setStaff((prev) => prev.filter((w) => w.id !== id));
    showToast(t("wk.deleted"));
  };

  // Kategoriya rejimi aniqlanguncha kutamiz
  if (modeLoading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  // Ustalar faqat uses_staff kategoriyalar (sartaroshxona) uchun
  if (!hasWorkers) {
    return (
      <Screen>
        <View style={styles.backRow}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <View style={{ flex: 1 }}>
            <PageHeader title={t("pv.workers_title")} subtitle="" />
          </View>
        </View>
        <Card>
          <EmptyState icon={Users} title={t("wk.not_supported")} desc={t("wk.not_supported_desc")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.backRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader title={t("pv.workers_title")} subtitle={t("pv.workers_sub")} />
        </View>
      </View>

      {/* Narx rejimi tugmasi — ustalar o'z narxini belgilaydimi */}
      <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
        <View style={styles.pricingRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.formTitle}>{t("wk.pricing_self")}</Text>
            <Text style={styles.hint}>{t("wk.pricing_self_hint")}</Text>
          </View>
          <TogglePill value={selfPricing} onToggle={toggleSelfPricing} />
        </View>
      </GlassSurface>

      {/* Yaratilgan login/parol kartasi */}
      {credentials && (
        <GlassSurface
          style={styles.credCard}
          fallbackStyle={styles.credCardFallback}
          tintColor={alpha(colors.primaryContainer, 0.3)}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <KeyRound size={16} color={colors.primary} />
            <Text style={styles.credTitle}>{t("wk.created_title")}</Text>
          </View>
          <Text style={styles.credDesc}>{t("wk.created_desc")}</Text>
          <View style={styles.credRow}>
            <Text style={styles.credLabel}>{t("wk.credentials_login")}</Text>
            <Text style={styles.credValue} selectable>
              {credentials.username}
            </Text>
          </View>
          <View style={styles.credRow}>
            <Text style={styles.credLabel}>{t("wk.credentials_password")}</Text>
            <Text style={styles.credValue} selectable>
              {credentials.password}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <SmallButton
              label={t("wk.share")}
              icon={Share2}
              onPress={shareCredentials}
              style={{ flex: 1 }}
            />
            <SmallButton
              label={t("wk.done")}
              icon={Check}
              variant="outline"
              onPress={() => setCredentials(null)}
            />
          </View>
        </GlassSurface>
      )}

      {!formOpen && <SmallButton label={t("wk.add")} icon={UserPlus} onPress={openAdd} />}

      {/* Qo'shish formasi */}
      {formOpen && (
        <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <UserPlus size={16} color={colors.primary} />
            <Text style={styles.formTitle}>{t("wk.add")}</Text>
          </View>

          <View>
            <Text style={styles.label}>{t("wk.name")}</Text>
            <TextInput
              value={name}
              onChangeText={onNameChange}
              placeholder={t("wk.name_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("wk.username")}</Text>
            <TextInput
              value={username}
              onChangeText={(v) => {
                setUsernameEdited(true);
                setUsername(v.toLowerCase().replace(/[^a-z0-9_.-]/g, ""));
              }}
              autoCapitalize="none"
              placeholder={t("wk.username_ph")}
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <Text style={styles.hint}>{t("wk.username_hint")}</Text>
          </View>

          <View>
            <Text style={styles.label}>{t("wk.password")}</Text>
            <View style={styles.pwRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                placeholder={t("wk.password_ph")}
                placeholderTextColor={colors.outline}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable onPress={() => setPassword(genPassword())}>
                <GlassSurface style={styles.genBtn} fallbackStyle={styles.genBtnFallback} interactive>
                  <Wand2 size={16} color={colors.primary} />
                </GlassSurface>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <SmallButton
              label={t("wk.create")}
              icon={Save}
              onPress={create}
              loading={creating}
              style={{ flex: 1 }}
            />
            <SmallButton label={t("common.cancel")} icon={X} variant="outline" onPress={resetForm} />
          </View>
        </GlassSurface>
      )}

      {/* Ro'yxat */}
      {loading ? (
        <Spinner />
      ) : staff.length === 0 && !formOpen ? (
        <Card>
          <EmptyState icon={Users} title={t("wk.empty")} desc={t("wk.empty_desc")} />
        </Card>
      ) : (
        staff.map((w) => {
          const title = localize(w.title, lang);
          return (
            <Card key={w.id} style={[{ padding: 16 }, !w.is_active && { opacity: 0.6 }]}>
              <View style={styles.workerTop}>
                <ClientAvatar name={w.full_name} avatarUrl={w.avatar_url} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.workerName} numberOfLines={1}>
                    {w.full_name || t("wk.unnamed")}
                  </Text>
                  {title ? (
                    <Text style={styles.workerSpec} numberOfLines={1}>
                      {title}
                    </Text>
                  ) : !w.profile_completed ? (
                    <Text style={styles.workerPending} numberOfLines={1}>
                      {t("wk.profile_incomplete")}
                    </Text>
                  ) : null}
                </View>
                {deleteId === w.id ? (
                  <SmallButton label={t("wk.delete_q")} variant="error" onPress={() => remove(w.id)} />
                ) : (
                  <SmallButton
                    label=""
                    icon={Trash2}
                    variant="error"
                    onPress={() => setDeleteId(w.id)}
                  />
                )}
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t("wk.active")}</Text>
                <TogglePill value={w.is_active} onToggle={() => toggleActive(w)} />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Clock size={13} color={colors.onSurfaceVariant} />
                  <Text style={styles.toggleLabel}>{t("wk.self_schedule")}</Text>
                </View>
                <TogglePill value={w.schedule_self_managed} onToggle={() => toggleSelfSchedule(w)} />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

export default function WorkersScreen() {
  return (
    <BusinessGate>
      <WorkersContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    backRow: { flexDirection: "row", alignItems: "center", gap: 12 },

    credCard: { borderRadius: radius.xl, padding: 20, gap: 12, overflow: "hidden" },
    credCardFallback: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.4),
    },
    credTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
    credDesc: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
    credRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    credLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    credValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
    },

    form: { borderRadius: radius.xl, padding: 20, gap: 16, overflow: "hidden" },
    formFallback: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.4),
    },
    formTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
    pricingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    pwRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    genBtn: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    genBtnFallback: {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.4),
    },

    workerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    workerName: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
    workerSpec: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
    workerPending: { fontSize: 12, fontWeight: "600", color: colors.error, marginTop: 2 },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
    },
    toggleLabel: { fontSize: 14, fontWeight: "500", color: colors.onSurface },
  })
);
