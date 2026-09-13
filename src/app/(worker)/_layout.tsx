// Usta (worker) rejimi tab navigatsiyasi — Profil va Bronlar.
// Root layout role='worker' bo'lsa shu guruhga yo'naltiradi.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/context/ThemeContext";
import { WorkerProvider } from "@/context/WorkerContext";

export default function WorkerLayout() {
  const { t } = useLanguage();
  const colors = useColors();

  return (
    <WorkerProvider>
      <NativeTabs tintColor={colors.primary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            sf={{ default: "person", selected: "person.fill" }}
            src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="person" />}
          />
          <NativeTabs.Trigger.Label>{t("wk.tab_profile")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="bookings">
          <NativeTabs.Trigger.Icon sf="calendar" src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="calendar-month" />} />
          <NativeTabs.Trigger.Label>{t("wk.tab_bookings")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </WorkerProvider>
  );
}
