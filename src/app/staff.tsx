// Shifokorlar boshqaruvi (shifoxona/klinika) — services.tsx bilan bir xil tuzilma.
// Har bir shifokor bo'limga (provider_departments) biriktiriladi; ro'yxat bo'limlar
// bo'yicha guruhlanadi va har bir guruh sarlavhasida shifokorlar soni ko'rsatiladi.
// Surat: expo-image-picker → "business_images" bucket (menu.tsx bilan bir xil oqim).
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { SelectField } from "@/components/pv/select-field";
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
import { translateMultilingual } from "@/utils/translate";

// departments.tsx dagi jadval bilan bir xil — bu yerda faqat kerakli ustunlar
interface Department {
  id: string;
  name: any;
}

interface Staff {
  id: string;
  provider_id: string;
  department_id: string | null;
  full_name: string;
  // jsonb {uz,ru,en} yoki matn — localize() bilan ko'rsatiladi
  title: any;
  avatar_url: string | null;
  experience_years: number | null;
  is_active: boolean;
  sort_order: number;
  // Shifokorning O'Z akkaunti (auth.users.id). null bo'lsa — hali bog'lanmagan,
  // unga taklif (kirish) kodi berish mumkin.
  user_id: string | null;
}

// worker_credentials — shifokorning panelga kirish ma'lumotlari. worker_id
// provider_staff.id bilan bir xil (id'lar ko'chirilgan), RLS bo'yicha faqat
// biznes egasi ko'ra oladi.
interface WorkerCredential {
  worker_id: string;
  username: string;
  password: string;
}

// Shifokor surati uchun maksimal hajm
const MAX_IMAGE_MB = 5;

// Parol yopiq holatda shu ko'rinishda chiziladi
const PASSWORD_MASK = "••••••••";

function StaffContent() {
  const styles = useStyles();
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const router = useRouter();
  const { usesDepartments, loading: modeLoading } = useBookingMode();
  const providerId = provider?.id || null;
  const userId = provider?.user_id || null;

  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  // Migratsiya hali qo'llanmagan bo'lsa (jadval yo'q) — sahifa xato bermay yopiladi
  const [unavailable, setUnavailable] = useState(false);

  // Form holati
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [experience, setExperience] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [active, setActive] = useState(true);
  // Surat: yangi tanlangan lokal fayl yoki mavjud URL
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Taklif (kirish) kodi holati — bir vaqtda bitta shifokor uchun ochiladi
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Login/parol holati: worker_id → ma'lumot. credsReady=false bo'lsa
  // (migratsiya qo'llanmagan, jadval yo'q) blok umuman chizilmaydi.
  const [creds, setCreds] = useState<Record<string, WorkerCredential>>({});
  const [credsReady, setCredsReady] = useState(false);
  const [shownFor, setShownFor] = useState<Record<string, boolean>>({});
  const [credBusy, setCredBusy] = useState<string | null>(null);
  const [credErrors, setCredErrors] = useState<Record<string, string>>({});
  const [resetFor, setResetFor] = useState<string | null>(null);

  // Shifokorlarning login/paroli — bitta so'rov bilan. Jadval hali yaratilmagan
  // bo'lsa xato yutiladi va ekran bugungi ko'rinishida qoladi.
  const loadCreds = useCallback(async () => {
    if (!providerId) return;
    const { data, error } = await supabase
      .from("worker_credentials")
      .select("worker_id, username, password")
      .eq("provider_id", providerId);
    if (error) {
      setCredsReady(false);
      setCreds({});
      return;
    }
    const map: Record<string, WorkerCredential> = {};
    for (const row of (data as WorkerCredential[]) || []) map[row.worker_id] = row;
    setCredsReady(true);
    setCreds(map);
  }, [providerId]);

  const load = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    // select("*") — ustunlar to'plami o'zgarsa ham xato bermaydi
    const { data, error } = await supabase
      .from("provider_staff")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setUnavailable(!!error);
    setStaff((data as Staff[]) || []);

    // Bo'limlar — guruhlash va tanlov uchun (jadval yo'q bo'lsa bo'sh qoladi)
    const { data: deps } = await supabase
      .from("provider_departments")
      .select("*")
      .eq("provider_id", providerId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setDepartments((deps as Department[]) || []);

    await loadCreds();
    setLoading(false);
  }, [providerId, loadCreds]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const tm = setTimeout(load, 0);
    return () => clearTimeout(tm);
  }, [load]);

  // Bo'limlar bo'yicha guruhlar. Bayroqcha o'chiq bo'lsa — bitta sarlavhasiz guruh.
  const groups = useMemo<{ key: string; title: string | null; items: Staff[] }[]>(() => {
    if (!usesDepartments) {
      return [{ key: "all", title: null, items: staff }];
    }
    const result = departments.map((d) => ({
      key: d.id,
      title: localize(d.name, lang) || "—",
      items: staff.filter((s) => s.department_id === d.id),
    }));
    // Bo'limga biriktirilmagan (yoki o'chirilgan bo'limdagi) shifokorlar
    const orphans = staff.filter(
      (s) => !s.department_id || !departments.some((d) => d.id === s.department_id)
    );
    if (orphans.length > 0) {
      result.push({ key: "none", title: t("dep.none"), items: orphans });
    }
    return result;
  }, [staff, departments, usesDepartments, lang, t]);

  const resetForm = () => {
    setEditId(null);
    setFullName("");
    setPosition("");
    setExperience("");
    setDepartmentId("");
    setActive(true);
    setImageAsset(null);
    setImageUrl(null);
    setFormOpen(false);
  };

  const openAdd = () => {
    resetForm();
    // Bo'lim majburiy bo'lgani uchun birinchi bo'lim oldindan tanlanadi
    if (usesDepartments && departments.length > 0) setDepartmentId(departments[0].id);
    setFormOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditId(s.id);
    setFullName(s.full_name || "");
    setPosition(localize(s.title, lang) || "");
    setExperience(s.experience_years != null ? String(s.experience_years) : "");
    setDepartmentId(s.department_id || "");
    setActive(s.is_active);
    setImageAsset(null);
    setImageUrl(s.avatar_url);
    setFormOpen(true);
  };

  // Surat tanlash — faqat bitta, oldingisi almashtiriladi
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) {
      showToast(t("stf.img_too_big"), "error");
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
    if (!fullName.trim()) {
      showToast(t("stf.name_required"), "error");
      return;
    }
    // Shifoxonada shifokor albatta bo'limga tegishli bo'lishi shart —
    // bo'limsiz doktorni mijoz ilovasida topib bo'lmaydi
    if (usesDepartments && !departmentId) {
      showToast(t("stf.dept_required"), "error");
      return;
    }
    setSaving(true);
    try {
      const titleVal = position.trim() ? await translate(position) : null;
      const expNum = experience.trim() ? Math.max(0, parseInt(experience, 10) || 0) : null;

      // Yangi surat tanlangan bo'lsa — storage'ga yuklab, public URL olamiz
      let avatar = imageUrl;
      if (imageAsset) {
        const mime = imageAsset.mimeType || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        const filePath = `${userId || providerId}/staff/${Date.now()}.${ext}`;
        const arraybuffer = await fetch(imageAsset.uri).then((res) => res.arrayBuffer());
        const { error: upErr } = await supabase.storage
          .from("business_images")
          .upload(filePath, arraybuffer, { contentType: mime, cacheControl: "3600" });
        if (upErr) throw upErr;
        avatar = supabase.storage.from("business_images").getPublicUrl(filePath).data.publicUrl;
      }

      const payload: Record<string, unknown> = {
        provider_id: providerId,
        full_name: fullName.trim(),
        title: titleVal,
        avatar_url: avatar,
        experience_years: expNum,
        is_active: active,
      };
      // Bo'lim faqat bayroqcha yoqilganda yoziladi
      if (usesDepartments) payload.department_id = departmentId || null;

      if (editId) {
        const { error } = await supabase.from("provider_staff").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("provider_staff")
          .insert({ ...payload, sort_order: staff.length });
        if (error) throw error;
      }
      showToast(t("svc.saved"));
      resetForm();
      await load();
    } catch (e) {
      console.error("staff save failed:", e);
      showToast(t("svc.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    const { error } = await supabase.from("provider_staff").delete().eq("id", id);
    if (error) {
      showToast(t("svc.save_failed"), "error");
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== id));
    showToast(t("svc.deleted"));
  };

  const toggleActive = async (s: Staff) => {
    const next = !s.is_active;
    setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase
      .from("provider_staff")
      .update({ is_active: next })
      .eq("id", s.id);
    if (error) {
      setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: s.is_active } : x)));
      showToast(t("svc.save_failed"), "error");
    }
  };

  // ── Taklif (kirish) kodi ────────────────────────────────────────────────────
  // Shifokorga alohida akkaunt beriladi: ega kod yaratadi, shifokor provayder
  // ilovasida shu kodni kiritib klinikaga bog'lanadi (RPC: create_staff_invite).
  const openInvite = (s: Staff) => {
    setInviteFor(inviteFor === s.id ? null : s.id);
    setInviteEmail("");
    setInviteCode(null);
    setInviteError(null);
  };

  const createInvite = async (staffId: string) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      const email = inviteEmail.trim().toLowerCase();
      const { data, error } = await supabase.rpc("create_staff_invite", {
        p_staff_id: staffId,
        p_email: email || null,
      });
      // Migratsiya hali qo'llanmagan bo'lsa — funksiya umuman yo'q
      if (error) {
        setInviteError(t("inv.unavailable"));
        return;
      }
      const res = (data || {}) as { ok?: boolean; code?: string; error?: string };
      if (!res.ok || !res.code) {
        setInviteError(
          res.error === "forbidden"
            ? t("inv.err_forbidden")
            : res.error === "not_found"
              ? t("inv.err_not_found")
              : res.error === "already_linked"
                ? t("inv.err_already_linked")
                : res.error === "unauthorized"
                  ? t("inv.err_unauthorized")
                  : t("inv.err_failed")
        );
        return;
      }
      setInviteCode(res.code);
    } catch {
      setInviteError(t("inv.err_failed"));
    } finally {
      setInviteBusy(false);
    }
  };

  // Kodni ulashish — expo-clipboard yo'q, tizimning "Ulashish" oynasi ishlatiladi
  const shareInvite = async (code: string) => {
    try {
      await Share.share({ message: t("inv.share_msg", { code }) });
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  };

  // ── Login va parol (worker_credentials) ─────────────────────────────────────
  // Ega shifokor uchun akkaunt ochadi; login va parol faqat egaga ko'rinadi.
  // reset=true — mavjud akkauntga yangi parol beriladi.
  const provision = async (staffId: string, reset: boolean) => {
    setCredBusy(staffId);
    setResetFor(null);
    setCredErrors((p) => ({ ...p, [staffId]: "" }));
    try {
      const { data, error } = await supabase.rpc("provision_worker_login", {
        p_worker_id: staffId,
        p_reset: reset,
      });
      // Migratsiya hali qo'llanmagan bo'lsa — funksiya umuman yo'q
      if (error) {
        setCredErrors((p) => ({ ...p, [staffId]: t("wlg.unavailable") }));
        return;
      }
      const res = (data || {}) as {
        ok?: boolean;
        username?: string;
        password?: string;
        existing?: boolean;
        error?: string;
      };
      const username = res.username;
      const password = res.password;
      if (!res.ok || !username || !password) {
        setCredErrors((p) => ({
          ...p,
          [staffId]:
            res.error === "forbidden"
              ? t("wlg.err_forbidden")
              : res.error === "not_found"
                ? t("wlg.err_not_found")
                : res.error === "pgcrypto_missing"
                  ? t("wlg.err_pgcrypto")
                  : t("wlg.err_failed"),
        }));
        return;
      }
      // Yangi ma'lumot darhol ochiq ko'rsatiladi, so'ng ro'yxat yangilanadi
      setCreds((p) => ({ ...p, [staffId]: { worker_id: staffId, username, password } }));
      setCredsReady(true);
      setShownFor((p) => ({ ...p, [staffId]: true }));
      showToast(reset ? t("wlg.reset_done") : res.existing ? t("wlg.existing") : t("wlg.created"));
      await loadCreds();
    } catch {
      setCredErrors((p) => ({ ...p, [staffId]: t("wlg.err_failed") }));
    } finally {
      setCredBusy(null);
    }
  };

  const toggleShown = (staffId: string) =>
    setShownFor((p) => ({ ...p, [staffId]: !p[staffId] }));

  // Login va parolni bitta xabar qilib ulashish (expo-clipboard yo'q)
  const shareCred = async (c: WorkerCredential) => {
    try {
      await Share.share({
        message: t("wlg.share_msg", { login: c.username, password: c.password }),
      });
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  };

  // Guruh ichida tartibni almashtirish: umumiy ro'yxatda ikkalasining o'rni
  // almashadi, so'ng sort_order 0,1,2… qilib normallashtiriladi.
  const move = async (items: Staff[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const prev = staff;
    const ia = prev.findIndex((s) => s.id === items[index].id);
    const ib = prev.findIndex((s) => s.id === items[target].id);
    if (ia < 0 || ib < 0) return;
    const swapped = [...prev];
    [swapped[ia], swapped[ib]] = [swapped[ib], swapped[ia]];
    const normalized = swapped.map((s, i) => ({ ...s, sort_order: i }));
    setStaff(normalized);

    const dirty = normalized.filter(
      (s) => prev.find((p) => p.id === s.id)?.sort_order !== s.sort_order
    );
    const results = await Promise.all(
      dirty.map((s) =>
        supabase.from("provider_staff").update({ sort_order: s.sort_order }).eq("id", s.id)
      )
    );
    if (results.some((r) => r.error)) {
      setStaff(prev);
      showToast(t("svc.save_failed"), "error");
    }
  };

  // Kategoriya bayroqchalari aniqlanguncha noto'g'ri bo'lim ko'rinib qolmasin
  if (modeLoading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  const formImageUri = imageAsset?.uri || imageUrl;
  // Bo'lim majburiy — "biriktirilmagan" varianti taklif qilinmaydi
  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: localize(d.name, lang) || "—",
  }));

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.backRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <View style={{ flex: 1 }}>
          <PageHeader title={t("stf.title")} subtitle={t("stf.sub")} />
        </View>
      </View>

      {/* Migratsiya qo'llanmagan bo'lsa — forma ko'rsatilmaydi */}
      {unavailable ? (
        <Card>
          <EmptyState
            icon={Stethoscope}
            title={t("stf.unavailable")}
            desc={t("stf.unavailable_desc")}
          />
        </Card>
      ) : usesDepartments && departments.length === 0 ? (
        /* Bo'limsiz shifokor qo'shib bo'lmaydi — avval bo'lim yaratiladi */
        <Card>
          <EmptyState
            icon={Stethoscope}
            title={t("stf.need_dept")}
            desc={t("stf.need_dept_desc")}
          />
          <SmallButton label={t("dep.add")} icon={Plus} onPress={() => router.push("/departments")} />
        </Card>
      ) : (
        <>
          {!formOpen && <SmallButton label={t("stf.add")} icon={Plus} onPress={openAdd} />}

          {/* Forma — iOS 26 da shisha panel */}
          {formOpen && (
            <GlassSurface style={styles.form} fallbackStyle={styles.formFallback}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Stethoscope size={16} color={colors.primary} />
                <Text style={styles.formTitle}>{editId ? t("stf.edit") : t("stf.add")}</Text>
              </View>

              <View>
                <Text style={styles.label}>{t("stf.name")}</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t("stf.name_ph")}
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
              </View>

              <View>
                <Text style={styles.label}>{t("stf.position")}</Text>
                <TextInput
                  value={position}
                  onChangeText={setPosition}
                  placeholder={t("stf.position_ph")}
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
              </View>

              <View>
                <Text style={styles.label}>{t("stf.experience")}</Text>
                <TextInput
                  value={experience}
                  onChangeText={(v) => setExperience(v.replace(/[^\d]/g, ""))}
                  keyboardType="numeric"
                  placeholder={t("stf.experience_ph")}
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
              </View>

              {/* Bo'lim — faqat kategoriya bo'limlar bilan ishlaganda */}
              {usesDepartments && (
                <SelectField
                  label={t("dep.field")}
                  value={departmentId}
                  options={departmentOptions}
                  placeholder={t("dep.pick")}
                  onChange={setDepartmentId}
                />
              )}

              {/* Surat — faqat bitta */}
              <View>
                <Text style={styles.label}>{t("stf.photo")}</Text>
                {formImageUri ? (
                  <View style={styles.imageWrap}>
                    <Image source={{ uri: formImageUri }} style={styles.image} contentFit="cover" />
                    <Pressable style={styles.imageRemove} onPress={removeImage}>
                      <GlassSurface
                        style={styles.imageRemoveGlass}
                        fallbackStyle={{ backgroundColor: colors.errorContainer }}
                        tintColor={alpha(colors.errorContainer, 0.6)}
                        interactive
                      >
                        <X size={13} color={colors.onErrorContainer} />
                      </GlassSurface>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.imagePick} onPress={pickImage}>
                    <ImagePlus size={20} color={colors.onSurfaceVariant} />
                    <Text style={styles.imagePickText}>{t("stf.photo_pick")}</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TogglePill value={active} onToggle={() => setActive(!active)} />
                <Text style={{ fontSize: 14, fontWeight: "500", color: colors.onSurface }}>
                  {t("stf.active")}
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

          {/* Ro'yxat — bo'limlar bo'yicha guruhlangan */}
          {loading ? (
            <Spinner />
          ) : staff.length === 0 && !formOpen ? (
            <Card>
              <EmptyState icon={Stethoscope} title={t("stf.empty")} desc={t("stf.empty_desc")} />
            </Card>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={styles.group}>
                {/* Bo'lim sarlavhasi + shifokorlar soni */}
                {g.title ? (
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Text style={styles.groupCount}>{t("stf.count", { n: g.items.length })}</Text>
                  </View>
                ) : null}

                {g.items.map((s, i) => (
                  <Card key={s.id} style={[{ padding: 20 }, !s.is_active && { opacity: 0.6 }]}>
                    <View style={styles.stfTop}>
                      <ClientAvatar name={s.full_name} avatarUrl={s.avatar_url} size={48} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.stfName} numberOfLines={1}>
                          {s.full_name}
                        </Text>
                        {localize(s.title, lang) ? (
                          <Text style={styles.stfTitle} numberOfLines={2}>
                            {localize(s.title, lang)}
                          </Text>
                        ) : null}
                        {s.experience_years != null ? (
                          <Text style={styles.stfExp}>
                            {s.experience_years} {t("stf.years")}
                          </Text>
                        ) : null}
                      </View>
                      {/* Tartib o'zgartirish — yuqoriga/pastga */}
                      <View style={styles.orderRow}>
                        <Pressable onPress={() => move(g.items, i, -1)} disabled={i === 0}>
                          <GlassSurface
                            style={[styles.orderBtn, i === 0 && { opacity: 0.4 }]}
                            fallbackStyle={styles.orderBtnFallback}
                            interactive
                          >
                            <ChevronUp size={14} color={colors.onSurfaceVariant} />
                          </GlassSurface>
                        </Pressable>
                        <Pressable
                          onPress={() => move(g.items, i, 1)}
                          disabled={i === g.items.length - 1}
                        >
                          <GlassSurface
                            style={[styles.orderBtn, i === g.items.length - 1 && { opacity: 0.4 }]}
                            fallbackStyle={styles.orderBtnFallback}
                            interactive
                          >
                            <ChevronDown size={14} color={colors.onSurfaceVariant} />
                          </GlassSurface>
                        </Pressable>
                      </View>
                    </View>

                    {!s.is_active && (
                      <View style={styles.stfBadgeRow}>
                        <View style={styles.hiddenBadge}>
                          <Text style={styles.hiddenBadgeText}>{t("stf.hidden")}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.stfActions}>
                      <SmallButton
                        label={t("stf.edit")}
                        icon={Pencil}
                        variant="outline"
                        onPress={() => openEdit(s)}
                        style={{ flex: 1 }}
                      />
                      <Pressable onPress={() => toggleActive(s)}>
                        <GlassSurface
                          style={styles.iconAction}
                          fallbackStyle={styles.iconActionFallback}
                          interactive
                        >
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
                            <Text style={styles.deleteConfirmText}>{t("stf.delete_q")}</Text>
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

                    {/* Kirish ma'lumotlari — asosiy blok. Jadval yo'q bo'lsa chizilmaydi. */}
                    {credsReady ? (
                      <View style={styles.credBlock}>
                        {creds[s.id] ? (
                          <>
                            <View style={styles.credRow}>
                              <Text style={styles.credLabel}>{t("wlg.login")}</Text>
                              <Text style={styles.credValue} numberOfLines={1} selectable>
                                {creds[s.id].username}
                              </Text>
                            </View>
                            <View style={styles.credRow}>
                              <Text style={styles.credLabel}>{t("wlg.password")}</Text>
                              <Text
                                style={styles.credValue}
                                numberOfLines={1}
                                selectable={!!shownFor[s.id]}
                              >
                                {shownFor[s.id] ? creds[s.id].password : PASSWORD_MASK}
                              </Text>
                              {/* Parolni ko'rsatish/yashirish */}
                              <Pressable
                                onPress={() => toggleShown(s.id)}
                                hitSlop={8}
                                accessibilityLabel={
                                  shownFor[s.id] ? t("wlg.hide") : t("wlg.show")
                                }
                              >
                                {shownFor[s.id] ? (
                                  <EyeOff size={14} color={colors.onSurfaceVariant} />
                                ) : (
                                  <Eye size={14} color={colors.onSurfaceVariant} />
                                )}
                              </Pressable>
                            </View>
                            <Text style={styles.credHint}>{t("wlg.hint")}</Text>
                            <View style={styles.credActions}>
                              <SmallButton
                                label={t("wlg.share")}
                                icon={Share2}
                                variant="outline"
                                onPress={() => shareCred(creds[s.id])}
                                style={{ flex: 1 }}
                              />
                              {/* Ikki bosqichli tasdiq — o'chirish tugmasi bilan bir xil */}
                              <SmallButton
                                label={resetFor === s.id ? t("wlg.reset_q") : t("wlg.reset")}
                                icon={RefreshCw}
                                variant={resetFor === s.id ? "error" : "outline"}
                                loading={credBusy === s.id}
                                onPress={() =>
                                  resetFor === s.id ? provision(s.id, true) : setResetFor(s.id)
                                }
                              />
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.credHint}>{t("wlg.create_hint")}</Text>
                            <SmallButton
                              label={t("wlg.create")}
                              icon={KeyRound}
                              onPress={() => provision(s.id, false)}
                              loading={credBusy === s.id}
                              style={{ flex: 1 }}
                            />
                          </>
                        )}
                        {credErrors[s.id] ? (
                          <Text style={styles.credError}>{credErrors[s.id]}</Text>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Shifokor akkaunti: bog'langan bo'lsa — belgi, bo'lmasa — kod berish */}
                    <View style={styles.inviteRow}>
                      {s.user_id ? (
                        <View style={styles.linkedBadge}>
                          <Link2 size={11} color={colors.primary} />
                          <Text style={styles.linkedText}>{t("inv.linked")}</Text>
                        </View>
                      ) : (
                        <SmallButton
                          label={t("inv.action")}
                          icon={KeyRound}
                          variant="outline"
                          onPress={() => openInvite(s)}
                          style={{ flex: 1 }}
                        />
                      )}
                    </View>

                    {/* Kod paneli — email (ixtiyoriy) → kod → ulashish */}
                    {inviteFor === s.id && !s.user_id ? (
                      <View style={styles.invitePanel}>
                        {inviteError ? <Text style={styles.inviteError}>{inviteError}</Text> : null}
                        {inviteCode ? (
                          <>
                            <Text style={styles.inviteLabel}>{t("inv.code_label")}</Text>
                            {/* Nusxa olish uchun uzoq bosiladi (selectable) */}
                            <Text style={styles.inviteCode} selectable>
                              {inviteCode}
                            </Text>
                            <Text style={styles.inviteHint}>{t("inv.code_hint")}</Text>
                            <Text style={styles.inviteNote}>{t("inv.code_note")}</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <SmallButton
                                label={t("inv.share")}
                                icon={Share2}
                                onPress={() => shareInvite(inviteCode)}
                                style={{ flex: 1 }}
                              />
                              <SmallButton
                                label={t("inv.regenerate")}
                                icon={KeyRound}
                                variant="outline"
                                onPress={() => createInvite(s.id)}
                                loading={inviteBusy}
                              />
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.inviteLabel}>{t("inv.email_label")}</Text>
                            <TextInput
                              value={inviteEmail}
                              onChangeText={setInviteEmail}
                              placeholder={t("inv.email_ph")}
                              placeholderTextColor={colors.outline}
                              autoCapitalize="none"
                              autoCorrect={false}
                              keyboardType="email-address"
                              style={styles.input}
                            />
                            <Text style={styles.inviteHint}>{t("inv.email_hint")}</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <SmallButton
                                label={t("inv.generate")}
                                icon={KeyRound}
                                onPress={() => createInvite(s.id)}
                                loading={inviteBusy}
                                style={{ flex: 1 }}
                              />
                              <SmallButton
                                label={t("common.cancel")}
                                icon={X}
                                variant="outline"
                                onPress={() => setInviteFor(null)}
                              />
                            </View>
                          </>
                        )}
                      </View>
                    ) : null}
                  </Card>
                ))}
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

export default function StaffScreen() {
  return (
    <BusinessGate>
      <StaffContent />
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
    overflow: "hidden",
  },
  imageRemoveGlass: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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

  group: { gap: 12 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  groupCount: { fontSize: 12, fontWeight: "500", color: colors.onSurfaceVariant },

  stfTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  stfName: { fontWeight: "700", fontSize: 16, color: colors.onSurface },
  stfTitle: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  stfExp: { fontSize: 12, color: colors.secondary, marginTop: 4, fontWeight: "600" },
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
  stfBadgeRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
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
  stfActions: {
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

  // ── Login va parol ──
  // Tinch ikkilamchi blok: rangli panel emas, oddiy qatorlar
  credBlock: { marginTop: 14, gap: 8 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  credLabel: { fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant, width: 58 },
  credValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: colors.onSurface,
    // Login/parol belgilarini adashtirmaslik uchun monokenglik shrift
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  credActions: { flexDirection: "row", gap: 8 },
  credHint: { fontSize: 11, color: colors.outline, lineHeight: 16 },
  credError: { fontSize: 12, fontWeight: "600", color: colors.error },

  // ── Taklif (kirish) kodi ──
  inviteRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: alpha(colors.primaryContainer, 0.18),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  linkedText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  invitePanel: {
    marginTop: 12,
    padding: 14,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  inviteLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inviteCode: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 7,
    textAlign: "center",
    color: colors.primary,
    paddingVertical: 6,
  },
  inviteHint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  inviteNote: { fontSize: 11, color: colors.outline },
  inviteError: { fontSize: 12, fontWeight: "600", color: colors.error },
}));
