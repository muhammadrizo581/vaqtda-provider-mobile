// Jadval va bandlik — saytdagi app/dashboard/schedule/page.tsx dan port.
// Sana asosidagi jadval: ish vaqtlari + tanaffuslar, 8 haftagacha oldinga.
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Armchair,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Layers,
  Monitor,
  Plus,
  Save,
  Tag,
  Timer,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessGate } from "@/components/pv/business-gate";
import { Screen } from "@/components/pv/screen";
import { TimeField } from "@/components/pv/time-field";
import { useToast } from "@/components/pv/toast";
import { Card, GlassIconButton, SmallButton, Spinner, TogglePill } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";
import { useProvider } from "@/context/ProviderContext";
import { useBookingMode } from "@/hooks/useBookingMode";
import { supabase } from "@/lib/supabase";
import { localize } from "@/utils/localize";
import {
  addDaysStr,
  createTashkentClock,
  formatUzDate,
  UZ_WEEKDAYS,
  weekdayKeyOf,
} from "@/utils/tashkent";

// ─── Toshkent soati (modul darajasida bitta nusxa) ───────────────────────────
const tashkentClock = createTashkentClock();

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot {
  id: string;
  start: string;
  end: string;
}
interface BreakSlot {
  id: string;
  start: string;
  end: string;
  label: string;
}
interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
  breaks: BreakSlot[];
}
type ScheduleMap = Record<string, DaySchedule>; // kalit — "YYYY-MM-DD" (aniq sana)

// slots rejimida davomiylik xizmatlardan olinadi; table rejimida esa
// slotMinutes — har bir stol/kompyuter broni qancha vaqtga band qilinishini belgilaydi.
interface TimetableConfig {
  bufferMinutes: number;
  slotMinutes: number;
}

const DEFAULT_CONFIG: TimetableConfig = { bufferMinutes: 0, slotMinutes: 60 };

const BUFFER_OPTIONS = [0, 5, 10, 15, 30];
const SLOT_DURATION_OPTIONS = [30, 45, 60, 90, 120, 180];
const MAX_WEEKS = 8;
const WD_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

let counter = 200;
const uid = () => String(++counter);

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// bugundan shu yakshanbagacha necha kun
function daysToSunday(dateStr: string): number {
  const i = WD_ORDER.indexOf(weekdayKeyOf(dateStr));
  return 6 - (i < 0 ? 0 : i);
}

// ikki sana orasidagi kun farqi (b - a)
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

const emptyDay = (): DaySchedule => ({ enabled: false, slots: [], breaks: [] });

// ─── Component ────────────────────────────────────────────────────────────────
function ScheduleContent() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();
  const { provider } = useProvider();
  const { showToast } = useToast();
  const { mode, unit, loading: modeLoading } = useBookingMode();
  // daily (dacha/villa): kun faqat ochiq/yopiq — vaqt oralig'i tahrirlanmaydi, xizmat ixtiyoriy
  const daily = mode === "daily";
  // table (restoran, kompyuter klub): xizmat yo'q — kamida bitta faol stol/kompyuter kerak
  const tableMode = mode === "table";
  const pcUnit = unit === "computer";
  const router = useRouter();
  const providerId = provider?.id || null;

  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [config, setConfig] = useState<TimetableConfig>(DEFAULT_CONFIG);
  const [weeksAhead, setWeeksAhead] = useState(1);
  // Boshlang'ich qiymat — bugungi sana (effekt o'rniga lazy initializer)
  const [expandedDate, setExpandedDate] = useState<string | null>(() => tashkentClock.now().dateStr);
  const [copyMenuOpen, setCopyMenuOpen] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Faol xizmatlar soni — slots rejimida saqlash uchun kamida 1 ta bo'lishi shart
  const [activeServices, setActiveServices] = useState<number>(0);
  // Faol stollar/kompyuterlar soni — table rejimida kamida 1 ta bo'lishi shart
  const [activeTables, setActiveTables] = useState<number>(0);

  // ── Toshkent vaqti (jonli) ──────────────────────────────────────────────────
  const [tashNow, setTashNow] = useState(() => tashkentClock.now());
  useEffect(() => {
    tashkentClock.sync(supabase).then(() => setTashNow(tashkentClock.now()));
    const id = setInterval(() => setTashNow(tashkentClock.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Ko'rinadigan sanalar: bugundan boshlab weeksAhead hafta oxirigacha
  const visibleDates = useMemo(() => {
    const today = tashNow.dateStr;
    const lastOffset = daysToSunday(today) + 7 * (weeksAhead - 1);
    const arr: string[] = [];
    for (let i = 0; i <= lastOffset; i++) arr.push(addDaysStr(today, i));
    return arr;
  }, [tashNow.dateStr, weeksAhead]);

  const weekGroups = useMemo(() => {
    const groups: { label: string; dates: string[] }[] = [];
    visibleDates.forEach((date) => {
      const isMonday = weekdayKeyOf(date) === "Monday";
      if (groups.length === 0 || isMonday) {
        const idx = groups.length;
        groups.push({
          label:
            idx === 0 ? t("tt.this_week") : idx === 1 ? t("tt.next_week") : t("tt.week_n", { n: idx + 1 }),
          dates: [],
        });
      }
      groups[groups.length - 1].dates.push(date);
    });
    return groups;
  }, [visibleDates, t]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: cfg } = await supabase
        .from("timetable_config")
        .select("*")
        .eq("provider_id", providerId)
        .maybeSingle();
      if (cfg)
        setConfig({
          bufferMinutes: cfg.buffer_minutes || 0,
          slotMinutes: cfg.slot_duration_minutes || 60,
        });

      const { count: svcCount } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("is_active", true);
      setActiveServices(svcCount || 0);

      const { count: tblCount } = await supabase
        .from("restaurant_tables")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("is_active", true);
      setActiveTables(tblCount || 0);

      const today = tashkentClock.now().dateStr;
      const { data: slotsData } = await supabase
        .from("timetable_slots")
        .select("*")
        .eq("provider_id", providerId)
        .not("slot_date", "is", null)
        .gte("slot_date", today);
      const { data: breaksData } = await supabase
        .from("timetable_breaks")
        .select("*")
        .eq("provider_id", providerId)
        .not("slot_date", "is", null)
        .gte("slot_date", today);

      const map: ScheduleMap = {};
      (slotsData || []).forEach((s: any) => {
        const d = s.slot_date as string;
        if (!map[d]) map[d] = { enabled: true, slots: [], breaks: [] };
        map[d].slots.push({ id: s.id, start: s.start_time, end: s.end_time });
      });
      (breaksData || []).forEach((b: any) => {
        const d = b.slot_date as string;
        if (!map[d]) map[d] = { enabled: true, slots: [], breaks: [] };
        map[d].breaks.push({ id: b.id, start: b.start_time, end: b.end_time, label: localize(b.label) });
      });
      setSchedule(map);

      // weeksAhead ni eng uzoq belgilangan sanaga moslaymiz
      const dates = Object.keys(map).sort();
      if (dates.length > 0) {
        const offset = dayDiff(today, dates[dates.length - 1]);
        const need = 1 + Math.max(0, Math.ceil((offset - daysToSunday(today)) / 7));
        setWeeksAhead(Math.max(1, need));
      }
    } catch {
      setError(t("tt.err_load"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  // setTimeout — effekt ichida sinxron setState bo'lmasligi uchun
  useEffect(() => {
    const t = setTimeout(loadData, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  // ── Validatsiya ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    for (const date of visibleDates) {
      const day = schedule[date];
      if (!day?.enabled) continue;

      if (day.slots.length === 0) {
        return t("tt.val_no_time", { date: formatUzDate(date) });
      }
      for (let i = 0; i < day.slots.length; i++) {
        const s = day.slots[i];
        if (timeToMin(s.start) >= timeToMin(s.end)) {
          return t("tt.val_end_after", { date: formatUzDate(date), n: i + 1 });
        }
      }
      const sorted = [...day.slots].sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (timeToMin(sorted[i].start) < timeToMin(sorted[i - 1].end)) {
          return t("tt.val_overlap", { date: formatUzDate(date) });
        }
      }
      for (const b of day.breaks) {
        if (timeToMin(b.start) >= timeToMin(b.end)) {
          return t("tt.val_break_end", { date: formatUzDate(date) });
        }
      }
    }
    // Xizmat talabi rejimga bog'liq: slots — majburiy, daily — ixtiyoriy,
    // table — xizmat o'rniga kamida bitta faol stol/kompyuter bo'lishi kerak
    if (!modeLoading) {
      if (mode === "slots" && activeServices === 0) {
        return t("tt.val_need_service");
      }
      if (tableMode && activeTables === 0) {
        return t(pcUnit ? "tt.val_need_computer" : "tt.val_need_table");
      }
    }
    return null;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!providerId) return;
    setError(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const today = tashNow.dateStr;
      let maxOffset = 0;
      const slotsToInsert: any[] = [];
      const breaksToInsert: any[] = [];

      for (const date of visibleDates) {
        const day = schedule[date];
        if (!day?.enabled || day.slots.length === 0) continue;
        maxOffset = Math.max(maxOffset, dayDiff(today, date));
        const dow = weekdayKeyOf(date);
        day.slots.forEach((s) =>
          slotsToInsert.push({
            provider_id: providerId,
            slot_date: date,
            day_of_week: dow,
            start_time: s.start,
            end_time: s.end,
            is_available: true,
          })
        );
        day.breaks.forEach((b) =>
          breaksToInsert.push({
            provider_id: providerId,
            slot_date: date,
            day_of_week: dow,
            start_time: b.start,
            end_time: b.end,
            label: b.label || "Tanaffus",
          })
        );
      }

      const configPayload: Record<string, unknown> = {
        buffer_minutes: config.bufferMinutes,
        slot_duration_minutes: Math.max(15, config.slotMinutes),
        schedule_days: Math.max(1, maxOffset + 1),
        updated_at: new Date().toISOString(),
      };

      const { data: existingConfig } = await supabase
        .from("timetable_config")
        .select("id")
        .eq("provider_id", providerId)
        .maybeSingle();
      const upsertConfig = async (payload: Record<string, unknown>) => {
        if (existingConfig) {
          return supabase.from("timetable_config").update(payload).eq("provider_id", providerId);
        }
        // duration_type/... — legacy ustunlar, insert'da neytral qiymat
        return supabase.from("timetable_config").insert({
          provider_id: providerId,
          ...payload,
          duration_type: "fixed",
          fixed_durations: [],
          flexible_min: 10,
        });
      };

      let { error: cfgErr } = await upsertConfig(configPayload);
      if (cfgErr && `${cfgErr.message}`.includes("slot_duration_minutes")) {
        // DBda ustun hali qo'shilmagan bo'lsa, jadvalni bu maydonsiz saqlayveramiz
        const { slot_duration_minutes: _omit, ...rest } = configPayload;
        void _omit;
        ({ error: cfgErr } = await upsertConfig(rest));
      }
      if (cfgErr) throw cfgErr;

      // Kelajakdagi yozuvlarni o'chirib, qaytadan yozamiz (o'tganlarga tegilmaydi)
      await supabase
        .from("timetable_slots")
        .delete()
        .eq("provider_id", providerId)
        .or(`slot_date.gte.${today},slot_date.is.null`);
      await supabase
        .from("timetable_breaks")
        .delete()
        .eq("provider_id", providerId)
        .or(`slot_date.gte.${today},slot_date.is.null`);

      if (slotsToInsert.length > 0) {
        const { error: slotErr } = await supabase.from("timetable_slots").insert(slotsToInsert);
        if (slotErr) throw slotErr;
      }
      if (breaksToInsert.length > 0) {
        const { error: brErr } = await supabase.from("timetable_breaks").insert(breaksToInsert);
        if (brErr) throw brErr;
      }

      setSaved(true);
      showToast(t("tt.toast_saved"));
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t("tt.err_save"));
    } finally {
      setSaving(false);
    }
  };

  // ── Schedule helpers ────────────────────────────────────────────────────────
  const setDay = (date: string, updater: (d: DaySchedule) => DaySchedule) => {
    setSchedule((prev) => ({ ...prev, [date]: updater(prev[date] || emptyDay()) }));
  };

  const toggleDay = (date: string) => {
    setSchedule((prev) => {
      const cur = prev[date] || emptyDay();
      const enabled = !cur.enabled;
      return {
        ...prev,
        [date]: {
          enabled,
          slots:
            enabled && cur.slots.length === 0
              ? // Kunlik rejimda kun to'liq band qilinadi (00:00–23:59)
                [daily ? { id: uid(), start: "00:00", end: "23:59" } : { id: uid(), start: "09:00", end: "18:00" }]
              : cur.slots,
          breaks: cur.breaks,
        },
      };
    });
  };

  const addSlot = (date: string) =>
    setDay(date, (d) => ({ ...d, slots: [...d.slots, { id: uid(), start: "09:00", end: "18:00" }] }));
  const removeSlot = (date: string, id: string) =>
    setDay(date, (d) => ({ ...d, slots: d.slots.filter((s) => s.id !== id) }));
  const updateSlot = (date: string, id: string, field: "start" | "end", value: string) =>
    setDay(date, (d) => ({
      ...d,
      slots: d.slots.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));

  const addBreak = (date: string) =>
    setDay(date, (d) => ({
      ...d,
      breaks: [...d.breaks, { id: uid(), start: "13:00", end: "14:00", label: "Tushlik tanaffusi" }],
    }));
  const removeBreak = (date: string, id: string) =>
    setDay(date, (d) => ({ ...d, breaks: d.breaks.filter((b) => b.id !== id) }));
  const updateBreak = (date: string, id: string, field: "start" | "end" | "label", value: string) =>
    setDay(date, (d) => ({
      ...d,
      breaks: d.breaks.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    }));

  const copyFromDate = (toDate: string, fromDate: string) => {
    const src = schedule[fromDate];
    if (!src) return;
    setSchedule((prev) => ({
      ...prev,
      [toDate]: {
        enabled: true,
        slots: src.slots.map((s) => ({ ...s, id: uid() })),
        breaks: src.breaks.map((b) => ({ ...b, id: uid() })),
      },
    }));
    setCopyMenuOpen(null);
  };

  const getCopyableDates = (currentDate: string) => {
    const idx = visibleDates.indexOf(currentDate);
    const result: string[] = [];
    for (let i = idx - 1; i >= 0 && result.length < 3; i--) {
      const d = visibleDates[i];
      if (schedule[d]?.enabled && schedule[d].slots.length > 0) result.push(d);
    }
    return result;
  };

  // Jonli holat: bugun hozir ochiqmi
  const liveStatus = useMemo(() => {
    const today = schedule[tashNow.dateStr];
    if (!today?.enabled || today.slots.length === 0) {
      return { open: false, label: t("tt.live_closed_today") };
    }
    const nowMin = timeToMin(tashNow.hhmm);
    const inBreak = today.breaks.some(
      (b) => nowMin >= timeToMin(b.start) && nowMin < timeToMin(b.end)
    );
    if (inBreak) return { open: false, label: t("tt.live_break") };
    const inSlot = today.slots.some(
      (s) => nowMin >= timeToMin(s.start) && nowMin < timeToMin(s.end)
    );
    if (inSlot) return { open: true, label: t("tt.live_open") };
    const next = today.slots
      .map((s) => timeToMin(s.start))
      .filter((m) => m > nowMin)
      .sort((a, b) => a - b)[0];
    if (next !== undefined) {
      const h = String(Math.floor(next / 60)).padStart(2, "0");
      const m = String(next % 60).padStart(2, "0");
      return { open: false, label: t("tt.live_opens_at", { time: `${h}:${m}` }) };
    }
    return { open: false, label: t("tt.live_closed") };
  }, [schedule, tashNow.dateStr, tashNow.hhmm, t]);

  const activeDays = visibleDates.filter((d) => schedule[d]?.enabled).length;
  const totalSlots = visibleDates.reduce(
    (sum, d) => sum + (schedule[d]?.enabled ? schedule[d].slots.length : 0),
    0
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Screen scroll={false}>
        <Spinner style={{ flex: 1 }} />
      </Screen>
    );
  }

  const statTiles = [
    { icon: CalendarDays, value: String(activeDays), label: t("tt.stat_days"), color: colors.primary, bg: alpha(colors.primaryContainer, 0.2) },
    { icon: Clock, value: String(totalSlots), label: t("tt.stat_slots"), color: colors.secondary, bg: alpha(colors.secondaryContainer, 0.2) },
    tableMode
      ? { icon: pcUnit ? Monitor : Armchair, value: String(activeTables), label: t(pcUnit ? "tt.stat_computers" : "tt.stat_tables"), color: colors.primary, bg: alpha(colors.primaryContainer, 0.2) }
      : { icon: Tag, value: String(activeServices), label: t("tt.stat_services"), color: colors.primary, bg: alpha(colors.primaryContainer, 0.2) },
    { icon: Timer, value: config.bufferMinutes > 0 ? `${config.bufferMinutes}m` : "—", label: t("tt.stat_buffer"), color: colors.tertiary, bg: alpha(colors.tertiaryContainer, 0.2) },
  ];

  return (
    <Screen>
      {/* Header */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GlassIconButton onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.onSurfaceVariant} />
          </GlassIconButton>
          <CalendarDays size={24} color={colors.primary} />
          <Text style={styles.title}>{t("pv.schedule_title")}</Text>
        </View>
        <Text style={styles.subtitle}>{t("tt.subtitle")}</Text>

        {/* Jonli Toshkent vaqti + holat */}
        <View style={styles.liveRow}>
          <View style={styles.clockChip}>
            <View style={styles.liveDot} />
            <Clock size={13} color={colors.primary} />
            <Text style={styles.clockText}>
              {UZ_WEEKDAYS[tashNow.weekdayKey]}, {formatUzDate(tashNow.dateStr)} · {tashNow.hhmm}
            </Text>
            <Text style={styles.clockSub}>{t("tt.tashkent_time")}</Text>
          </View>
          <View
            style={[
              styles.statusChip,
              liveStatus.open
                ? {
                    backgroundColor: alpha(colors.primaryContainer, 0.2),
                    borderColor: alpha(colors.primaryContainer, 0.4),
                  }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: liveStatus.open ? colors.primary : colors.outline },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: liveStatus.open ? colors.primary : colors.onSurfaceVariant },
              ]}
            >
              {liveStatus.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Saqlash tugmasi */}
      <SmallButton
        label={saving ? t("common.saving") : saved ? t("tt.saved") : t("common.save")}
        icon={saved ? CheckCircle2 : Save}
        onPress={handleSave}
        loading={saving}
      />

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          {((tableMode && activeTables === 0) || (mode === "slots" && activeServices === 0)) && (
            <Pressable onPress={() => router.push("/services")}>
              <Text style={styles.errorLink}>
                {tableMode ? t(pcUnit ? "pv.nav_computers" : "pv.nav_tables") : t("pv.nav_services")} →
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Stats */}
      <View style={styles.statTiles}>
        {statTiles.map((s) => (
          <View key={s.label} style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: s.bg }]}>
              <s.icon size={18} color={s.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statTileValue}>{s.value}</Text>
              <Text style={styles.statTileLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Sanalar jadvali */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("tt.tab_schedule")}</Text>
          <Text style={styles.cardDesc}>{t("tt.card_desc")}</Text>
        </View>

        {weekGroups.map((group) => (
          <View key={group.label}>
            {/* Hafta sarlavhasi */}
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{group.label}</Text>
              <Text style={styles.weekCount}>
                {t("tt.days_count", {
                  a: group.dates.filter((d) => schedule[d]?.enabled).length,
                  b: group.dates.length,
                })}
              </Text>
            </View>

            {group.dates.map((date) => {
              const day = schedule[date] || emptyDay();
              const isExpanded = expandedDate === date;
              const isToday = date === tashNow.dateStr;
              const copyable = getCopyableDates(date);

              return (
                <View
                  key={date}
                  style={[
                    { borderTopWidth: 1, borderTopColor: colors.outlineVariant },
                    isToday && { backgroundColor: alpha(colors.primaryContainer, 0.05) },
                  ]}
                >
                  {/* Kun qatori */}
                  <Pressable
                    style={styles.dayRow}
                    onPress={() => !daily && setExpandedDate(isExpanded ? null : date)}
                  >
                    <View style={styles.dayLeft}>
                      <TogglePill value={day.enabled} onToggle={() => toggleDay(date)} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.dayTitleRow}>
                          <Text
                            style={[
                              styles.dayName,
                              { color: day.enabled ? colors.onSurface : colors.onSurfaceVariant },
                            ]}
                          >
                            {UZ_WEEKDAYS[weekdayKeyOf(date)]}
                          </Text>
                          <View style={styles.dateBadge}>
                            <Text style={styles.dateBadgeText}>{formatUzDate(date)}</Text>
                          </View>
                          {isToday && (
                            <View style={styles.todayBadge}>
                              <Text style={styles.todayBadgeText}>{t("tt.today")}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.daySub} numberOfLines={1}>
                          {day.enabled
                            ? daily
                              ? t("tt.daily_open")
                              : `${t("tt.work_count", { n: day.slots.length })}${
                                  day.breaks.length > 0
                                    ? ` · ${t("tt.break_count", { n: day.breaks.length })}`
                                    : ""
                                }`
                            : t("tt.not_visible")}
                        </Text>
                      </View>
                    </View>
                    {!daily && (
                      <ChevronDown
                        size={16}
                        color={colors.onSurfaceVariant}
                        style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
                      />
                    )}
                  </Pressable>

                  {/* Kengaytirilgan — yoqilgan (kunlik rejimda tahrirlash yo'q) */}
                  {!daily && isExpanded && day.enabled && (
                    <View style={styles.expanded}>
                      {/* Nusxa olish */}
                      <View>
                        <Pressable
                          style={styles.copyBtn}
                          onPress={() => setCopyMenuOpen(copyMenuOpen === date ? null : date)}
                        >
                          <Text style={styles.copyBtnText}>{t("tt.copy")}</Text>
                          <ChevronDown
                            size={12}
                            color={colors.onSurfaceVariant}
                            style={{
                              transform: [{ rotate: copyMenuOpen === date ? "180deg" : "0deg" }],
                            }}
                          />
                        </Pressable>
                        {copyMenuOpen === date && (
                          <View style={styles.copyMenu}>
                            {copyable.length > 0 ? (
                              <>
                                <Text style={styles.copyMenuTitle}>{t("tt.copy_from")}</Text>
                                {copyable.map((d) => (
                                  <Pressable
                                    key={d}
                                    style={styles.copyMenuItem}
                                    onPress={() => copyFromDate(date, d)}
                                  >
                                    <Text style={styles.copyMenuItemText}>
                                      {UZ_WEEKDAYS[weekdayKeyOf(d)]}, {formatUzDate(d)}
                                    </Text>
                                    <Text style={styles.copyMenuItemCount}>
                                      {schedule[d].slots.length}
                                    </Text>
                                  </Pressable>
                                ))}
                              </>
                            ) : (
                              <Text style={styles.copyMenuEmpty}>{t("tt.no_prev")}</Text>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Ish vaqti */}
                      <View>
                        <Text style={styles.sectionLabel}>{t("tt.work_time")}</Text>
                        {day.slots.map((slot) => {
                          const invalid = timeToMin(slot.start) >= timeToMin(slot.end);
                          return (
                            <View
                              key={slot.id}
                              style={[
                                styles.slotRow,
                                invalid && { borderColor: alpha(colors.error, 0.6) },
                              ]}
                            >
                              <TimeField
                                label={t("tt.start")}
                                value={slot.start}
                                invalid={invalid}
                                onChange={(v) => updateSlot(date, slot.id, "start", v)}
                              />
                              <Text style={styles.dash}>—</Text>
                              <TimeField
                                label={t("tt.end")}
                                value={slot.end}
                                invalid={invalid}
                                onChange={(v) => updateSlot(date, slot.id, "end", v)}
                              />
                              <Pressable
                                style={styles.trashBtn}
                                onPress={() => removeSlot(date, slot.id)}
                              >
                                <Trash2 size={16} color={colors.error} />
                              </Pressable>
                            </View>
                          );
                        })}
                        <Pressable style={styles.addDashed} onPress={() => addSlot(date)}>
                          <Plus size={14} color={colors.primary} />
                          <Text style={styles.addDashedText}>{t("tt.add_time")}</Text>
                        </Pressable>
                      </View>

                      {/* Tanaffuslar */}
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <Coffee size={12} color={colors.onSurfaceVariant} />
                          <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>
                            {t("tt.breaks")}
                          </Text>
                        </View>
                        {day.breaks.map((br) => (
                          <View key={br.id} style={styles.breakCard}>
                            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.sectionLabel}>{t("tt.name")}</Text>
                                <TextInput
                                  value={br.label}
                                  onChangeText={(v) => updateBreak(date, br.id, "label", v)}
                                  placeholder={t("tt.lunch")}
                                  placeholderTextColor={colors.outline}
                                  style={styles.breakInput}
                                />
                              </View>
                              <Pressable
                                style={styles.trashBtn}
                                onPress={() => removeBreak(date, br.id)}
                              >
                                <Trash2 size={16} color={colors.error} />
                              </Pressable>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 }}>
                              <TimeField
                                label={t("tt.start")}
                                value={br.start}
                                onChange={(v) => updateBreak(date, br.id, "start", v)}
                              />
                              <Text style={styles.dash}>—</Text>
                              <TimeField
                                label={t("tt.end")}
                                value={br.end}
                                onChange={(v) => updateBreak(date, br.id, "end", v)}
                              />
                            </View>
                          </View>
                        ))}
                        <Pressable
                          style={[styles.addDashed, { borderColor: colors.outlineVariant }]}
                          onPress={() => addBreak(date)}
                        >
                          <Coffee size={14} color={colors.onSurfaceVariant} />
                          <Text style={[styles.addDashedText, { color: colors.onSurfaceVariant }]}>
                            {t("tt.add_break")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Kengaytirilgan — o'chirilgan */}
                  {isExpanded && !day.enabled && (
                    <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
                      <Text style={styles.dayOffText}>{t("tt.day_off")}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Keyingi hafta qo'shish */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          {weeksAhead < MAX_WEEKS ? (
            <Pressable
              style={styles.addDashed}
              onPress={() => setWeeksAhead((w) => Math.min(MAX_WEEKS, w + 1))}
            >
              <CalendarPlus size={14} color={colors.primary} />
              <Text style={styles.addDashedText}>{t("tt.add_week")}</Text>
            </Pressable>
          ) : (
            <Text style={styles.maxWeeksText}>{t("tt.max_weeks", { n: MAX_WEEKS })}</Text>
          )}
        </View>
      </Card>

      {/* Bron davomiyligi — faqat table rejimida (xizmat yo'q, davomiylik shu yerdan olinadi) */}
      {tableMode && (
        <Card style={{ padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Timer size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>{t("tt.slotdur_title")}</Text>
          </View>
          <Text style={[styles.cardDesc, { marginTop: 2, marginBottom: 16 }]}>
            {t("tt.slotdur_desc")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SLOT_DURATION_OPTIONS.map((v) => (
              <Pressable
                key={v}
                onPress={() => setConfig((c) => ({ ...c, slotMinutes: v }))}
                style={[
                  styles.bufferBtn,
                  config.slotMinutes === v
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.bufferText,
                    { color: config.slotMinutes === v ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}
                >
                  {v % 60 === 0 ? `${v / 60} ${t("unit.hour")}` : `${v} ${t("common.min")}`}
                </Text>
              </Pressable>
            ))}
            <TextInput
              value={String(config.slotMinutes)}
              onChangeText={(v) => {
                const n = parseInt(v.replace(/[^\d]/g, ""), 10);
                setConfig((c) => ({ ...c, slotMinutes: Math.max(15, n || 15) }));
              }}
              keyboardType="numeric"
              style={styles.slotDurInput}
            />
          </View>
        </Card>
      )}

      {/* Oraliq vaqt (buffer) */}
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Layers size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>{t("tt.buffer_title")}</Text>
        </View>
        <Text style={[styles.cardDesc, { marginTop: 2, marginBottom: 16 }]}>
          {t("tt.buffer_desc")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {BUFFER_OPTIONS.map((v) => (
            <Pressable
              key={v}
              onPress={() => setConfig((c) => ({ ...c, bufferMinutes: v }))}
              style={[
                styles.bufferBtn,
                config.bufferMinutes === v
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                    },
              ]}
            >
              <Text
                style={[
                  styles.bufferText,
                  {
                    color:
                      config.bufferMinutes === v ? colors.onPrimary : colors.onSurfaceVariant,
                  },
                ]}
              >
                {v === 0 ? t("tt.buffer_none") : `${v} ${t("common.min")}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

export default function ScheduleScreen() {
  return (
    <BusinessGate>
      <ScheduleContent />
    </BusinessGate>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 4 },

  liveRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  clockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  clockText: { fontSize: 11, fontWeight: "700", color: colors.onSurface },
  clockSub: { fontSize: 10, fontWeight: "600", color: colors.onSurfaceVariant },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: alpha(colors.errorContainer, 0.2),
    borderWidth: 1,
    borderColor: alpha(colors.errorContainer, 0.4),
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: "600" },
  errorLink: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  statTiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: 14,
    flexBasis: "47%",
    flexGrow: 1,
  },
  statTileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statTileValue: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  statTileLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurface },
  cardDesc: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  weekHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerLowest,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  weekCount: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: "600" },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dayLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  dayTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  dayName: { fontWeight: "700", fontSize: 14 },
  dateBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dateBadgeText: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceVariant },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.onPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  daySub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

  expanded: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 4,
    gap: 16,
    backgroundColor: alpha(colors.surfaceContainerLowest, 0.5),
  },

  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceContainerLowest,
  },
  copyBtnText: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceVariant },
  copyMenu: {
    marginTop: 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  copyMenuTitle: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 9,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  copyMenuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copyMenuItemText: { fontSize: 12, fontWeight: "700", color: colors.onSurface },
  copyMenuItemCount: { fontSize: 9, color: colors.onSurfaceVariant },
  copyMenuEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  dash: { color: colors.onSurfaceVariant, fontWeight: "700", marginBottom: 10 },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.errorContainer, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  addDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(colors.primary, 0.3),
    borderRadius: radius.lg,
  },
  addDashedText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  breakCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  breakInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },

  dayOffText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    paddingVertical: 20,
  },
  maxWeeksText: {
    textAlign: "center",
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontWeight: "600",
    paddingVertical: 8,
  },

  bufferBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    alignItems: "center",
  },
  slotDurInput: {
    width: 80,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  bufferText: { fontSize: 12, fontWeight: "700" },
}));
