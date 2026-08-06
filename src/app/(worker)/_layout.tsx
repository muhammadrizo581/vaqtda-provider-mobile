// Usta (worker) rejimi tab navigatsiyasi — Profil va Bronlar.
// Root layout role='worker' bo'lsa shu guruhga yo'naltiradi.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Icon, Label, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
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
          <Icon
            sf={{ default: "person", selected: "person.fill" }}
            androidSrc={<VectorIcon family={MaterialIcons} name="person" />}
          />
          <Label>{t("wk.tab_profile")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="bookings">
          <Icon sf="calendar" androidSrc={<VectorIcon family={MaterialIcons} name="calendar-month" />} />
          <Label>{t("wk.tab_bookings")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </WorkerProvider>
  );
}
