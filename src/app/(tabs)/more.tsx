// Boshqa tabi — ekran tanasi src/screens/more.tsx da.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import MoreScreen from "@/screens/more";

export default function MoreTab() {
  return (
    <TabSwipe tab="/more">
      <MoreScreen />
    </TabSwipe>
  );
}
