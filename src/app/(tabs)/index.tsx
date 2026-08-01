// Boshqaruv tabi — ekran tanasi src/screens/dashboard.tsx da, bu yerda faqat
// marshrut + gorizontal swipe bilan qo'shni tabga o'tish.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import DashboardScreen from "@/screens/dashboard";

export default function DashboardTab() {
  return (
    <TabSwipe tab="/">
      <DashboardScreen />
    </TabSwipe>
  );
}
