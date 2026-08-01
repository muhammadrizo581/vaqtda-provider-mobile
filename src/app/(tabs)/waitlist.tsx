// Navbat tabi — ekran tanasi src/screens/waitlist.tsx da.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import WaitlistScreen from "@/screens/waitlist";

export default function WaitlistTab() {
  return (
    <TabSwipe tab="/waitlist">
      <WaitlistScreen />
    </TabSwipe>
  );
}
