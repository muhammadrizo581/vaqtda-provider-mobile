// Kirish splash'i — brend introsi (assets/intro). To'liq ekran yashil radial
// gradient (markaz sage → brend → chetlarda qorong'i, native splash #0c1310 ga
// ulanadi), belgi barglari markazdan "gullab" ochiladi → galochka chiziladi →
// "Vaqtda" so'zi ko'tarilib chiqadi, oxirida ekran kattalashib xiralashadi va
// onDone chaqiriladi. Tema mustaqil (native splash kabi brend rangida).
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { AnimatedLogo } from "@/components/animated-logo";

const WORD_DELAY = 1150; // "Vaqtda" so'zi galochka bilan birga ko'tariladi
const FADE_DUR = 450;

export function VaqtdaSplash({
  onDone,
  duration = 2400,
}: {
  /** Fade tugagach chaqiriladi */
  onDone?: () => void;
  /** Fade boshlanadigan umumiy davomiylik (ms) */
  duration?: number;
}) {
  const word = useSharedValue(0);
  const gone = useSharedValue(0);

  useEffect(() => {
    word.value = withDelay(
      WORD_DELAY,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    gone.value = withDelay(
      duration - FADE_DUR,
      withTiming(1, { duration: FADE_DUR, easing: Easing.in(Easing.quad) }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ scale: 1 + 0.06 * gone.value }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: 12 * (1 - word.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Brend yashil radial: markaz sage → #567157 → chetlarda #0c1310
              (native splash foni bilan mos — bir tekis o'tish) */}
          <RadialGradient id="vqbg" cx="50%" cy="38%" rx="95%" ry="80%">
            <Stop offset="0" stopColor="#6e8d6e" />
            <Stop offset="0.42" stopColor="#567157" />
            <Stop offset="0.78" stopColor="#46603f" />
            <Stop offset="1" stopColor="#0c1310" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vqbg)" />
      </Svg>
      <AnimatedLogo variant="intro" size={112} background={null} foreground="#FFFFFF" />
      <Animated.Text style={[styles.word, wordStyle]}>Vaqtda</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: 20, zIndex: 20 },
  word: { color: "#FFFFFF", fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
});
