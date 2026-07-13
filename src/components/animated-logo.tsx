// Vaqtda logotipining animatsion versiyasi.
//
// variant="intro" (default) — ilovaga kirganda bir marta o'ynaydi (~2s):
//   0–0.9s  yaproqlar TO'LIQ OQ holicha ketma-ket paydo bo'lib, soat
//           yo'nalishida bitta aylana yasaydi — to'lgani to'la turadi
//   1.0–1.26s yaproqlar konturga qaytadi, faqat chap-yuqori (to'la) yaproq
//           to'la qoladi — logotipning asl holati
//   1.12–1.64s galochka stroke bo'ylab chiziladi
//   1.48–1.98s butun logo yengil puls qiladi
// variant="loading" — xuddi shu aylanma to'lish, lekin cheksiz; yuklanish holatlari uchun.
import React, { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { G, Path, Rect } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Variant = "intro" | "loading";

// Intro taymlayni (ms): STEP — yaproqdan yaproqqa o'tish, bitta aylana = 8 qadam
const STEP = 110;
const RELEASE_START = 1000; // yaproqlar konturga qaytishni boshlaydi
const RELEASE_END = 1260;
const CHECK_START = 1120;
const CHECK_END = 1640;
const PULSE_PEAK = 1780;
const INTRO_TOTAL = 1980;
// Loading: to'liq aylana davomiyligi (ms)
const SPIN_CYCLE = 1280;

// Bitta yaproq (marquise) — ichki uchi (0,0) da, tepaga qaragan.
// Ichki uch markazdan 36px da turadi (galochkaga tegmasligi uchun).
const LEAF_PATH = "M0 0 C 9 -7, 10 -24, 0 -34 C -10 -24, -9 -7, 0 0 Z";
const LEAF_INNER_R = 64; // translate(100, 100 - 36)
// Galochka uzunligi ~74 — dash-offset chizish uchun
const CHECK_LEN = 75;
const CHECK_PATH = "M74 100 L90 118 L122 80";
// Soat yo'nalishida: 0° tepada, 315° — to'la yaproq (aylanish shunda tugaydi)
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Leaf({
  angle,
  index,
  t,
  color,
  variant,
}: {
  angle: number;
  index: number;
  t: SharedValue<number>;
  color: string;
  variant: Variant;
}) {
  const filled = angle === 315;

  const props = useAnimatedProps(() => {
    if (variant === "loading") {
      // phase: 0 — "bosh" shu yaproqda (to'la), 1 ga qarab so'nadi
      const phase = (((t.value - index / 8) % 1) + 1) % 1;
      return {
        scale: 1 + 0.09 * Math.max(0, 1 - phase * 6),
        fillOpacity: Math.pow(1 - phase, 1.4),
      };
    }
    // Intro: yaproq i i*STEP da TO'LIQ OQ holicha paydo bo'ladi va shu holicha
    // turadi; aylana to'lgach (RELEASE) konturga qaytadi, to'la yaproq qoladi
    const ms = t.value * INTRO_TOTAL;
    const appear = index * STEP;
    let fill = 0;
    if (ms >= appear) {
      fill = filled
        ? 1
        : 1 - interpolate(ms, [RELEASE_START, RELEASE_END], [0, 1], Extrapolation.CLAMP);
    }
    return {
      // Paydo bo'lish overshoot bilan, fill bilan bir vaqtda
      scale: interpolate(ms, [appear, appear + 230, appear + 350], [0, 1.12, 1], Extrapolation.CLAMP),
      fillOpacity: fill,
    };
  });

  return (
    <G transform={`rotate(${angle}, 100, 100) translate(100, ${LEAF_INNER_R})`}>
      <AnimatedG animatedProps={props}>
        <Path d={LEAF_PATH} fill={color} stroke={color} strokeWidth={5} strokeLinejoin="round" />
      </AnimatedG>
    </G>
  );
}

// Saytdagi asosiy brend yashili — intro/loading shu rangda chiziladi
const BRAND_GREEN = "#8DAE91";

export function AnimatedLogo({
  variant = "intro",
  size = 160,
  background = "#0E8F6D",
  foreground = BRAND_GREEN,
  onFinish,
}: {
  variant?: Variant;
  size?: number;
  /** null — orqa fon (yashil kvadrat) chizilmaydi */
  background?: string | null;
  foreground?: string;
  /** Faqat intro'da: animatsiya tugagach chaqiriladi */
  onFinish?: () => void;
}) {
  // Bitta umumiy taymlayn 0..1 — hamma bosqichlar shundan interpolate qilinadi.
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    if (variant === "loading") {
      t.value = withRepeat(withTiming(1, { duration: SPIN_CYCLE, easing: Easing.linear }), -1);
    } else {
      t.value = withTiming(1, { duration: INTRO_TOTAL, easing: Easing.linear }, (done) => {
        if (done && onFinish) runOnJS(onFinish)();
      });
    }
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Kirish (faqat intro): butun ikonka 0.85 → 1 masshtab + xiralikdan chiqish
  const enter = useAnimatedStyle(() => {
    if (variant === "loading") return { opacity: 1, transform: [{ scale: 1 }] };
    return {
      opacity: interpolate(t.value, [0, 450 / INTRO_TOTAL], [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(t.value, [0, 450 / INTRO_TOTAL], [0.85, 1], Extrapolation.CLAMP) }],
    };
  });

  // Yakuniy puls (faqat intro): 1 → 1.045 → 1
  const pulse = useAnimatedProps(() => ({
    scale:
      variant === "loading"
        ? 1
        : interpolate(t.value, [CHECK_END / INTRO_TOTAL, PULSE_PEAK / INTRO_TOTAL, 1], [1, 1.045, 1], Extrapolation.CLAMP),
    origin: "100, 100",
  }));

  // Galochka: loading'da statik to'liq, intro'da chizilib chiqadi
  const check = useAnimatedProps(() => {
    if (variant === "loading") return { strokeDashoffset: 0 };
    const p = interpolate(t.value, [CHECK_START / INTRO_TOTAL, CHECK_END / INTRO_TOTAL], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: CHECK_LEN * (1 - Easing.out(Easing.cubic)(p)) };
  });

  return (
    <Animated.View style={[{ width: size, height: size }, enter]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {background ? <Rect x={0} y={0} width={200} height={200} rx={48} fill={background} /> : null}
        <AnimatedG animatedProps={pulse}>
          {ANGLES.map((a, i) => (
            <Leaf key={a} angle={a} index={i} t={t} color={foreground} variant={variant} />
          ))}
          {/* Galochka faqat intro'da — loading'da faqat yaproqlar aylanadi */}
          {variant === "intro" && (
            <AnimatedPath
              animatedProps={check}
              d={CHECK_PATH}
              fill="none"
              stroke={foreground}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[CHECK_LEN, CHECK_LEN]}
            />
          )}
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}
