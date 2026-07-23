// Kirish splash'i — artifactdagi yangi logo introsi bilan, ilovaning
// faol temasida: radial fon (Zumrad palitra) + belgi orqasida
// yumshoq yashil nur. Yashil kvadrat ikon "gullab" ochiladi (aylanma to'lish →
// galochka → puls), so'ng "Vaqtda" so'zi ko'tarilib chiqadi, oxirida butun
// ekran kattalashib xiralashadi va onDone chaqiriladi.
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
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { AnimatedLogo, BRAND_GREEN } from "@/components/animated-logo";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const WORD_DELAY = 1480; // "Vaqtda" so'zi logo pulsi bilan birga ko'tariladi
const FADE_DUR = 450;

export function VaqtdaSplash({
  onDone,
  duration = 2900,
}: {
  /** Fade tugagach chaqiriladi */
  onDone?: () => void;
  /** Fade boshlanadigan umumiy davomiylik (ms) */
  duration?: number;
}) {
  const styles = useStyles();
  const colors = useColors();
  const word = useSharedValue(0);
  const gone = useSharedValue(0);

  useEffect(() => {
    word.value = withDelay(WORD_DELAY, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    gone.value = withDelay(
      duration - 250,
      withTiming(1, { duration: FADE_DUR, easing: Easing.in(Easing.quad) }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ scale: 1 + 0.05 * gone.value }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: 12 * (1 - word.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Fon: markazda biroz ko'tarilgan navy, chetlarda chuqur qorong'i */}
          <RadialGradient id="vqbg" cx="50%" cy="40%" rx="90%" ry="70%">
            <Stop offset="0" stopColor={colors.surfaceContainerLow} />
            <Stop offset="0.55" stopColor={colors.background} />
            <Stop offset="1" stopColor={colors.surfaceContainerLowest} />
          </RadialGradient>
          {/* Belgi orqasidagi yumshoq yashil nur */}
          <RadialGradient id="vqglow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={BRAND_GREEN} stopOpacity={0.2} />
            <Stop offset="0.6" stopColor={BRAND_GREEN} stopOpacity={0.08} />
            <Stop offset="1" stopColor={BRAND_GREEN} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vqbg)" />
        <Circle cx="50%" cy="44%" r="34%" fill="url(#vqglow)" />
      </Svg>
      <AnimatedLogo variant="intro" size={128} />
      <Animated.Text style={[styles.word, wordStyle]}>Vaqtda</Animated.Text>
    </Animated.View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { alignItems: "center", justifyContent: "center", gap: 20, zIndex: 20 },
    word: { color: colors.onSurface, fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  })
);
