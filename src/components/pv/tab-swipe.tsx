// Instagram uslubidagi gorizontal swipe — qo'shni tabga o'tish.
// NativeTabs (tizim liquid glass bari) pager'ga ruxsat bermaydi, shuning uchun
// pan gesture aniqlanib router orqali qo'shni tabga almashtiramiz.
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useStaffRoleContext } from "@/context/StaffRoleContext";

// Tartib (tabs)/_layout.tsx dagi triggerlar bilan bir xil bo'lishi shart
const TABS = ["/", "/appointments", "/chat", "/waitlist", "/more"] as const;
export type TabPath = (typeof TABS)[number];

export function TabSwipe({ tab, children }: { tab: TabPath; children: React.ReactNode }) {
  const router = useRouter();
  const { isStaff } = useStaffRoleContext();
  // Shifokorda Navbat tabi yashirin — surish ham unga tushib qolmasin
  const tabs: readonly TabPath[] = isStaff ? TABS.filter((x) => x !== "/waitlist") : TABS;
  const idx = tabs.indexOf(tab);

  const go = (dir: 1 | -1) => {
    const next = tabs[idx + dir];
    if (next !== undefined) router.navigate(next);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    // Faqat keskin gorizontal harakatda faollashadi — vertikal scroll va
    // ichki gorizontal ro'yxatlar (kun tablari) ustunlikda qoladi.
    .activeOffsetX([-20, 20])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -44 || e.velocityX < -650) go(1); // chapga surish → keyingi tab
      else if (e.translationX > 44 || e.velocityX > 650) go(-1); // o'ngga surish → oldingi tab
    });

  return (
    <GestureDetector gesture={pan}>
      {/* collapsable={false} — RN bu View'ni optimizatsiyada yutib yubormasin,
          aks holda gesture bog'lanadigan native view yo'qolib qoladi */}
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
