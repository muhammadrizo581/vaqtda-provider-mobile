// Vaqt maydoni — zamonaviy, ikkala OS (iOS / Android) da bir xil
// yuqori darajadagi "Grafit Zumrad" dizayndagi vaqt tanlagich (Bottom Sheet).
import { Check, Clock, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassSurface } from "@/components/pv/ui";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_STEP_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const MINUTES_STEP_1 = Array.from({ length: 60 }, (_, i) => i);

const PRESETS = [
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "13:00",
  "14:00",
  "18:00",
  "19:00",
  "20:00",
  "22:00",
];

const pad = (n: number) => String(n).padStart(2, "0");

// "HH:MM" -> soat va daqiqa (noto'g'ri qiymatda 09:00)
function parseTime(value: string): { h: number; m: number } {
  const [hStr, mStr] = (value || "09:00").slice(0, 5).split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return {
    h: isNaN(h) ? 9 : Math.min(23, Math.max(0, h)),
    m: isNaN(m) ? 0 : Math.min(59, Math.max(0, m)),
  };
}

export function TimeField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string; // "HH:MM"
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { lang } = useLanguage();
  const ru = lang === "ru";

  const [open, setOpen] = useState(false);
  const [stepFive, setStepFive] = useState(true);

  // Tanlangan vaqt vaqtinchalik holati
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const minutesList = stepFive ? MINUTES_STEP_5 : MINUTES_STEP_1;

  // Ochishda tanlovni joriy qiymatga moslaymiz (effekt ichida emas — ortiqcha render bo'lmasin)
  const openPicker = () => {
    const { h, m } = parseTime(value);
    setSelectedHour(h);
    setSelectedMinute(m);
    // Agar 5-daqiqalik qadamda bo'lmasa, avtomatik 1-daqiqalik qadamga o'tkazish
    if (m % 5 !== 0) setStepFive(false);
    setOpen(true);
  };

  // Modal ochilgach ro'yxatlarni tanlangan vaqtga aylantiramiz
  useEffect(() => {
    if (!open) return;
    const { h: validH, m: validM } = parseTime(value);

    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        y: Math.max(0, (validH - 2) * 42),
        animated: true,
      });

      const minList = validM % 5 === 0 ? MINUTES_STEP_5 : MINUTES_STEP_1;
      const mIdx = minList.indexOf(validM);
      if (mIdx >= 0) {
        minuteScrollRef.current?.scrollTo({
          y: Math.max(0, (mIdx - 2) * 42),
          animated: true,
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, value]);

  const handleConfirm = () => {
    onChange(`${pad(selectedHour)}:${pad(selectedMinute)}`);
    setOpen(false);
  };

  const handlePreset = (preset: string) => {
    const [h, m] = preset.split(":").map(Number);
    setSelectedHour(h);
    setSelectedMinute(m);

    hourScrollRef.current?.scrollTo({
      y: Math.max(0, (h - 2) * 42),
      animated: true,
    });
    const mIdx = minutesList.indexOf(m);
    if (mIdx >= 0) {
      minuteScrollRef.current?.scrollTo({
        y: Math.max(0, (mIdx - 2) * 42),
        animated: true,
      });
    }
  };

  const displayTime = (value || "").slice(0, 5) || "09:00";

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.field,
          invalid && { borderColor: colors.error },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.fieldInner}>
          <Clock size={13} color={invalid ? colors.error : colors.primary} />
          <Text style={[styles.fieldText, invalid && { color: colors.error }]}>
            {displayTime}
          </Text>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropPress} onPress={() => setOpen(false)} />
          <GlassSurface style={styles.sheet} fallbackStyle={styles.sheetFallback}>
            {/* Grabber Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.clockIconWrap}>
                  <Clock size={16} color={colors.primary} />
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {label || (ru ? "Выберите время" : "Vaqtni tanlang")}
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <X size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>

            {/* Hero Digital Time Display */}
            <View style={styles.heroWrap}>
              <View style={styles.heroTimeCard}>
                <View style={styles.heroTimePart}>
                  <Text style={styles.heroTimeNum}>{pad(selectedHour)}</Text>
                  <Text style={styles.heroTimeLabel}>{ru ? "ЧАСЫ" : "SOAT"}</Text>
                </View>
                <Text style={styles.heroColon}>:</Text>
                <View style={styles.heroTimePart}>
                  <Text style={styles.heroTimeNum}>{pad(selectedMinute)}</Text>
                  <Text style={styles.heroTimeLabel}>{ru ? "МИНУТЫ" : "DAQIQA"}</Text>
                </View>
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsList}
              >
                {PRESETS.map((p) => {
                  const isSelected =
                    pad(selectedHour) === p.slice(0, 2) &&
                    pad(selectedMinute) === p.slice(3, 5);
                  return (
                    <Pressable
                      key={p}
                      onPress={() => handlePreset(p)}
                      style={({ pressed }) => [
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Columns: Hours & Minutes */}
            <View style={styles.columnsContainer}>
              {/* Hours Column */}
              <View style={styles.columnWrap}>
                <Text style={styles.columnHeader}>
                  {ru ? "SOAT (00 — 23)" : "SOAT (00 — 23)"}
                </Text>
                <ScrollView
                  ref={hourScrollRef}
                  showsVerticalScrollIndicator={false}
                  style={styles.columnScroll}
                  contentContainerStyle={styles.columnContent}
                >
                  {HOURS.map((h) => {
                    const active = h === selectedHour;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => setSelectedHour(h)}
                        style={({ pressed }) => [
                          styles.timeItem,
                          active && styles.timeItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeItemText,
                            active && styles.timeItemTextActive,
                          ]}
                        >
                          {pad(h)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Divider */}
              <View style={styles.colDivider} />

              {/* Minutes Column */}
              <View style={styles.columnWrap}>
                <View style={styles.minHeaderRow}>
                  <Text style={styles.columnHeader}>
                    {ru ? "DAQIQA" : "DAQIQA"}
                  </Text>
                  <Pressable
                    onPress={() => setStepFive((prev) => !prev)}
                    style={styles.stepToggle}
                    hitSlop={6}
                  >
                    <Text style={styles.stepToggleText}>
                      {stepFive ? "5 daq" : "1 daq"}
                    </Text>
                  </Pressable>
                </View>
                <ScrollView
                  ref={minuteScrollRef}
                  showsVerticalScrollIndicator={false}
                  style={styles.columnScroll}
                  contentContainerStyle={styles.columnContent}
                >
                  {minutesList.map((m) => {
                    const active = m === selectedMinute;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setSelectedMinute(m)}
                        style={({ pressed }) => [
                          styles.timeItem,
                          active && styles.timeItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeItemText,
                            active && styles.timeItemTextActive,
                          ]}
                        >
                          {pad(m)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.cancelText}>
                  {ru ? "Отмена" : "Bekor"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Check size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.confirmText}>
                  {ru ? "Выбрать" : "Tanlash"}
                </Text>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    label: {
      fontSize: 10,
      color: colors.onSurfaceVariant,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    field: {
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fieldInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    fieldText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
    },

    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    backdropPress: {
      flex: 1,
    },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: 28,
      paddingTop: 10,
      paddingHorizontal: 18,
      borderTopWidth: 1.5,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: alpha(colors.outlineVariant, 0.4),
      backgroundColor: colors.surfaceContainerHigh,
    },
    sheetFallback: {
      backgroundColor: colors.surfaceContainerHigh,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: alpha(colors.onSurfaceVariant, 0.35),
      alignSelf: "center",
      marginBottom: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    clockIconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      backgroundColor: alpha(colors.primary, 0.15),
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onSurface,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.5),
      alignItems: "center",
      justifyContent: "center",
    },

    heroWrap: {
      alignItems: "center",
      marginVertical: 8,
    },
    heroTimeCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(colors.primary, 0.08),
      borderWidth: 1.5,
      borderColor: alpha(colors.primary, 0.28),
      borderRadius: radius.xl,
      paddingVertical: 10,
      paddingHorizontal: 28,
      gap: 12,
    },
    heroTimePart: {
      alignItems: "center",
      minWidth: 54,
    },
    heroTimeNum: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
      letterSpacing: -1,
    },
    heroColon: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.primary,
      marginBottom: 14,
    },
    heroTimeLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 2,
    },

    presetsWrap: {
      marginVertical: 6,
    },
    presetsList: {
      flexDirection: "row",
      gap: 7,
      paddingVertical: 2,
    },
    presetChip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.6),
      borderWidth: 1,
      borderColor: alpha(colors.outlineVariant, 0.3),
    },
    presetChipActive: {
      backgroundColor: alpha(colors.primary, 0.2),
      borderColor: colors.primary,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
      fontVariant: ["tabular-nums"],
    },
    presetChipTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },

    columnsContainer: {
      flexDirection: "row",
      height: 200,
      backgroundColor: alpha(colors.surfaceContainerLowest, 0.65),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: alpha(colors.outlineVariant, 0.25),
      padding: 6,
      marginVertical: 10,
    },
    columnWrap: {
      flex: 1,
      paddingHorizontal: 4,
    },
    colDivider: {
      width: 1,
      backgroundColor: alpha(colors.outlineVariant, 0.2),
      marginVertical: 4,
    },
    columnHeader: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
      letterSpacing: 0.8,
      textAlign: "center",
      marginBottom: 6,
      textTransform: "uppercase",
    },
    minHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    stepToggle: {
      backgroundColor: alpha(colors.primary, 0.12),
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    stepToggleText: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.primary,
    },
    columnScroll: {
      flex: 1,
    },
    columnContent: {
      paddingBottom: 20,
    },
    timeItem: {
      height: 38,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 2,
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.25),
    },
    timeItemActive: {
      backgroundColor: colors.primary,
    },
    timeItemText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.onSurface,
      fontVariant: ["tabular-nums"],
    },
    timeItemTextActive: {
      color: "#ffffff",
      fontWeight: "800",
    },

    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.5),
      borderWidth: 1,
      borderColor: alpha(colors.outlineVariant, 0.3),
    },
    cancelText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.onSurface,
    },
    confirmBtn: {
      flex: 1.4,
      height: 44,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      backgroundColor: colors.primary,
    },
    confirmText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#ffffff",
    },
  })
);
