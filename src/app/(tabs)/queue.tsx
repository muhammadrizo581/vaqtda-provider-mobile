// Navbat tabi (shifokor uchun) — ekran tanasi src/screens/queue.tsx da.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import QueueScreen from "@/screens/queue";

export default function QueueTab() {
  return (
    <TabSwipe tab="/queue">
      <QueueScreen />
    </TabSwipe>
  );
}
