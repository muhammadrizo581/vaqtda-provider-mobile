// Pastki tab navigatsiya — iOS 26+ da tizimning Liquid Glass tab bari (NativeTabs).
// 5 bo'lim: Boshqaruv, Bronlar, Chat, Navbat, Boshqa (Jadval/Xizmatlar/Statistika shu yerda).
// Diqqat: iPhone'da 5 tadan ko'p trigger tizimning xunuk "More" ekranini ochadi —
// shuning uchun qolgan bo'limlar o'zimizning "Boshqa" ekranidan ochiladi.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Badge, Icon, Label, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/context/ThemeContext";
import { useChatUnread } from "@/hooks/useChatUnread";

export default function TabsLayout() {
  const { t } = useLanguage();
  const colors = useColors();
  const chatUnread = useChatUnread();

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="dashboard" />}
        />
        <Label>{t("pv.nav_dashboard")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments">
        <Icon sf="calendar" androidSrc={<VectorIcon family={MaterialIcons} name="calendar-month" />} />
        <Label>{t("pv.nav_appointments")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon
          sf={{ default: "message", selected: "message.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="chat" />}
        />
        <Label>{t("pv.nav_chat")}</Label>
        {chatUnread > 0 && <Badge>{chatUnread > 99 ? "99+" : String(chatUnread)}</Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="waitlist">
        <Icon sf="hourglass" androidSrc={<VectorIcon family={MaterialIcons} name="hourglass-empty" />} />
        <Label>{t("pv.nav_waitlist")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="more-horiz" />}
        />
        <Label>{t("pv.nav_more")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
