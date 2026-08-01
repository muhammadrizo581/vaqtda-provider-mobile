// Bronlar tabi — ekran tanasi src/screens/appointments.tsx da.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import AppointmentsScreen from "@/screens/appointments";

export default function AppointmentsTab() {
  return (
    <TabSwipe tab="/appointments">
      <AppointmentsScreen />
    </TabSwipe>
  );
}
