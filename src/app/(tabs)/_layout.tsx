import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import {
  CalendarDays,
  Hourglass,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Stethoscope,
} from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffRoleContext } from "@/context/StaffRoleContext";
import { useColors } from "@/context/ThemeContext";
import { useBookingMode } from "@/hooks/useBookingMode";
import { useChatUnread } from "@/hooks/useChatUnread";
import { TelegramTabBar } from "@/components/pv/telegram-tab-bar";

export default function TabsLayout() {
  const { t } = useLanguage();
  const colors = useColors();
  const chatUnread = useChatUnread();
  const { isStaff } = useStaffRoleContext();
  const { mode } = useBookingMode();
  // Navbat faqat vaqt bo'yicha xizmatlarda: kunlik ijarada (avto-ijara, dacha,
  // kvartira, mehmonxona, to'yxona) va restoran/kafeda (stol) u ma'nosiz
  const hideWaitlist = isStaff || mode !== "slots";

  // iOS da tizimning original Liquid Glass tab bari (NativeTabs) saqlanadi
  if (Platform.OS === "ios") {
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
        <NativeTabs.Trigger name="waitlist" hidden={hideWaitlist}>
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

  // Android va boshqa platformalarda — Telegram uslubidagi suzuvchi kapsula tab bar
  return (
    <Tabs
      tabBar={(props) => <TelegramTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("pv.nav_dashboard"),
          tabBarIcon: ({ color, focused }) => (
            <LayoutGrid size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t("pv.nav_appointments"),
          tabBarIcon: ({ color, focused }) => (
            <CalendarDays size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("pv.nav_chat"),
          tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? "99+" : chatUnread) : undefined,
          tabBarIcon: ({ color, focused }) => (
            <MessageSquare size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: t("pv.nav_waitlist"),
          href: hideWaitlist ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Hourglass size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: t("pv.nav_queue"),
          href: !isStaff ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Stethoscope size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("pv.nav_more"),
          tabBarIcon: ({ color, focused }) => (
            <MoreHorizontal size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
