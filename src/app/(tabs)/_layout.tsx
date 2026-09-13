// Pastki tab navigatsiya — iOS 26+ da tizimning Liquid Glass tab bari (NativeTabs).
// 5 bo'lim: Boshqaruv, Bronlar, Chat, Navbat, Boshqa (Jadval/Xizmatlar/Statistika shu yerda).
// Diqqat: iPhone'da 5 tadan ko'p trigger tizimning xunuk "More" ekranini ochadi —
// shuning uchun qolgan bo'limlar o'zimizning "Boshqa" ekranidan ochiladi.
//
// Klinika xodimi (shifokor) uchun panel cheklangan: Navbat (waitlist) butun
// biznesga tegishli bo'lgani uchun yashiriladi, o'rniga o'z bo'limidagi jonli
// navbat (queue) ko'rsatiladi; qolgan bo'limlar o'z ma'lumoti bilan ishlaydi.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { useColors } from "@/context/ThemeContext";
import { useChatUnread } from "@/hooks/useChatUnread";

export default function TabsLayout() {
  const { t } = useLanguage();
  const colors = useColors();
  const chatUnread = useChatUnread();
  const { isStaff } = useStaffRoleContext();

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="dashboard" />}
        />
        <NativeTabs.Trigger.Label>{t("pv.nav_dashboard")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments">
        <NativeTabs.Trigger.Icon sf="calendar" src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="calendar-month" />} />
        <NativeTabs.Trigger.Label>{t("pv.nav_appointments")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon
          sf={{ default: "message", selected: "message.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="chat" />}
        />
        <NativeTabs.Trigger.Label>{t("pv.nav_chat")}</NativeTabs.Trigger.Label>
        {chatUnread > 0 && <NativeTabs.Trigger.Badge>{chatUnread > 99 ? "99+" : String(chatUnread)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      {/* Navbat — butun biznes bo'yicha; shifokorga ko'rsatilmaydi */}
      <NativeTabs.Trigger name="waitlist" hidden={isStaff}>
        <NativeTabs.Trigger.Icon sf="hourglass" src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="hourglass-empty" />} />
        <NativeTabs.Trigger.Label>{t("pv.nav_waitlist")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Navbat — faqat shifokor uchun, o'z bo'limidagi jonli navbat */}
      <NativeTabs.Trigger name="queue" hidden={!isStaff}>
        <NativeTabs.Trigger.Icon sf="stethoscope" src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="hourglass-top" />} />
        <NativeTabs.Trigger.Label>{t("pv.nav_queue")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon
          sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="more-horiz" />}
        />
        <NativeTabs.Trigger.Label>{t("pv.nav_more")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
