// Instagram uslubidagi INTERAKTIV gorizontal pager.
// Barcha sahifalar bitta konteynerda yonma-yon turadi; barmoq harakati
// `translateX` (shared value) orqali UI thread'da 1:1 kuzatiladi — JS thread
// aralashmaydi, shuning uchun lag bo'lmaydi. Barmoq qo'yib yuborilganda eng
// yaqin sahifaga (yoki tezlik yetsa keyingisiga) spring bilan yopishadi.
//
// Faol indeks ikki bosqichda sinxronlanadi:
//   • `progress` (0..N-1 float) — LIVE, barmoq bilan birga (indikator uchun).
//   • `onIndexChange` — sahifa TINGANDA bir marta (bottom bar / header uchun).
import React from "react";
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// Snappy, overshoot'siz spring — pager chetidan oshib ketmaydi.
const SPRING = { damping: 22, stiffness: 210, mass: 0.5, overshootClamping: true } as const;
// Flick (tez surish) uchun tezlik chegarasi — px/soniya.
const FLICK_VELOCITY = 550;
// Chetlardagi "rubber-band" qarshiligi (0 = qattiq devor, 1 = erkin).
const RUBBER = 0.28;

export type SwipePagerRef = {
  /** Bottom bar / header'dagi teginish shu orqali sahifaga o'tadi. */
  goTo: (index: number, animated?: boolean) => void;
};

type Props = {
  /** Har bir sahifa — bitta bola element. Soni = sahifalar soni. */
  children: React.ReactNode;
  /** Boshlang'ich sahifa. */
  initialIndex?: number;
  /** Sahifa TINGANDA chaqiriladi (bottom bar holatini yangilash uchun). */
  onIndexChange?: (index: number) => void;
  /** LIVE progress (0..N-1). Indikatorlar shu bilan barmoqni real vaqtda kuzatadi. */
  progress?: SharedValue<number>;
  style?: ViewStyle;
};

export const SwipePager = React.forwardRef<SwipePagerRef, Props>(function SwipePager(
  { children, initialIndex = 0, onIndexChange, progress, style },
  ref,
) {
  const pages = React.Children.toArray(children);
  const count = pages.length;

  const { width } = useWindowDimensions();
  const translateX = useSharedValue(-initialIndex * width);
  const startX = useSharedValue(0);
  const widthSV = useSharedValue(width);
  const indexSV = useSharedValue(initialIndex);

  // Ekran o'lchami o'zgarsa (rotatsiya) — joriy sahifada qolamiz.
  React.useEffect(() => {
    widthSV.value = width;
    translateX.value = -indexSV.value * width;
  }, [width, widthSV, translateX, indexSV]);

  // translateX o'zgarishini `progress`ga ko'chiramiz — UI thread'da, uzluksiz
  // (ham drag paytida, ham spring animatsiyasi davomida).
  useAnimatedReaction(
    () => translateX.value,
    (tx) => {
      if (progress) progress.value = -tx / widthSV.value;
    },
  );

  // Bottom bar / header teginishi uchun imperativ boshqaruv.
  React.useImperativeHandle(
    ref,
    () => ({
      goTo: (index: number, animated = true) => {
        const clamped = Math.min(count - 1, Math.max(0, index));
        indexSV.value = clamped;
        const target = -clamped * width;
        translateX.value = animated ? withSpring(target, SPRING) : target;
        onIndexChange?.(clamped);
      },
    }),
    [count, width, translateX, indexSV, onIndexChange],
  );

  const pan = Gesture.Pan()
    // Faqat gorizontal harakatda faollashadi — vertikal scroll (ScrollView) va
    // ichki gorizontal ro'yxatlar ustunlikni saqlaydi.
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const w = widthSV.value;
      const min = -(count - 1) * w;
      let next = startX.value + e.translationX;
      // Chetlarda rubber-band — birinchi/oxirgi sahifadan tashqariga sekin cho'ziladi.
      if (next > 0) next = next * RUBBER;
      else if (next < min) next = min + (next - min) * RUBBER;
      translateX.value = next;
    })
    .onEnd((e) => {
      const w = widthSV.value;
      const currentF = -translateX.value / w; // hozirgi float pozitsiya
      let target = Math.round(currentF);
      // Tez flick — yarim yo'lga yetmasa ham keyingi/oldingi sahifaga o'tadi.
      if (e.velocityX < -FLICK_VELOCITY) target = Math.floor(currentF) + 1;
      else if (e.velocityX > FLICK_VELOCITY) target = Math.ceil(currentF) - 1;
      target = Math.min(count - 1, Math.max(0, target));

      translateX.value = withSpring(-target * w, SPRING);
      // Bottom bar sahifa tINGANDA yangilanadi (indexSV faqat UI thread ma'lumoti).
      if (target !== indexSV.value) {
        indexSV.value = target;
        if (onIndexChange) runOnJS(onIndexChange)(target);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: widthSV.value * count,
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* overflow: hidden — qo'shni sahifa chetdan ko'rinib qolmasin.
          collapsable={false} — RN bu native view'ni optimizatsiyada yutmasin. */}
      <View style={[styles.viewport, style]} collapsable={false}>
        <Animated.View style={[styles.row, rowStyle]}>
          {pages.map((page, i) => (
            <View key={i} style={{ width }}>
              {page}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  row: { flex: 1, flexDirection: "row" },
});
