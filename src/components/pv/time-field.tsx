// Vaqt maydoni — web'dagi <input type="time"> o'rnida.
// Bosilganda soat tanlagich ochiladi (iOS: modal g'ildirak, Android: dialog).
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "@/components/pv/ui";
import { radius } from "@/constants/colors";
import { makeThemedStyles, useColors, useTheme } from "@/context/ThemeContext";

function toDate(hhmm: string): Date {
  const [h, m] = (hhmm || "09:00").split(":").map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  return d;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const { scheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) onChange(toHHMM(date));
    } else if (date) {
      onChange(toHHMM(date));
    }
  };

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, invalid && { borderColor: colors.error }]}
      >
        <Text style={styles.fieldText}>{(value || "").slice(0, 5)}</Text>
      </Pressable>

      {open && Platform.OS === "android" && (
        <DateTimePicker value={toDate(value)} mode="time" is24Hour onChange={handleChange} />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="fade">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable onPress={() => {}}>
              <GlassSurface style={styles.sheet} fallbackStyle={styles.sheetFallback}>
                <DateTimePicker
                  value={toDate(value)}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                  themeVariant={scheme}
                  locale="uz-UZ"
                />
                <Pressable onPress={() => setOpen(false)}>
                  <GlassSurface
                    style={styles.doneBtn}
                    fallbackStyle={{ backgroundColor: colors.primary }}
                    tintColor={colors.primary}
                    interactive
                  >
                    <Text style={styles.doneText}>OK</Text>
                  </GlassSurface>
                </Pressable>
              </GlassSurface>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
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
  fieldText: { fontSize: 14, fontWeight: "600", color: colors.onSurface },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: 32,
    paddingTop: 8,
    overflow: "hidden",
  },
  sheetFallback: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  doneBtn: {
    marginHorizontal: 20,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  doneText: { color: colors.onPrimary, fontWeight: "700", fontSize: 14 },
}));
