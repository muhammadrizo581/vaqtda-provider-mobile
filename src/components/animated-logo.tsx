// Vaqtda logo — 8 barg (gul/quyosh) markazdan taraladi + o'rtada galochka.
// Geometriya brend assetlaridan olingan (assets/brand/vaqtda-mark.svg,
// viewBox 0 0 100 100, marjaz 50,50) — statik ikon bilan bir xil.
//
// Variantlar:
//   "intro"   — barglar markazdan ketma-ket "gullab" ochiladi (scale .15→1,
//               yengil burilish bilan), so'ng galochka chiziladi. Tugagach
//               onFinish chaqiriladi (~1.5s). background bo'lsa yumaloq kvadrat
//               ham xiralikdan chiqadi.
//   "loading" — barglar to'lqin bo'lib porlaydi (shimmer): opacity/scale
//               ketma-ket puls qiladi — brend loaderi (galochkasiz, assetdagi
//               VaqtdaLoader kabi). Cheksiz takrorlanadi.
import React, { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { G, Path, Rect } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Variant = "intro" | "loading";

// Belgi geometriyasi (viewBox 0 0 100 100, markaz 50,50)
// Bitta barg — tepaga qaragan; markaz atrofida 45° qadam bilan 8 marta aylantiriladi.
const PETAL = "M50 32.5 Q60.4 20.8 50 9.2 Q39.6 20.8 50 32.5 Z";
const TICK = "M42.68 50.39 L47.58 55.40 L57.33 43.83";
const TICK_LEN = 23; // galochka uzunligi (stroke-dash uchun)
const TICK_WIDTH = 4.63;
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Brend ranglari (assets/brand — #567157 sage yashil)
export const BRAND_GREEN = "#567157";
export const BRAND_GREEN_DEEP = "#46603f";

// Intro taymlayni (ms)
const INTRO_TOTAL = 1500;
const PETAL_DELAY = 50; // birinchi barg kechikishi
const PETAL_STEP = 60; // har barg orasidagi kechikish
const PETAL_DUR = 550; // bitta barg gullashi
const TICK_START = 950;
const TICK_DUR = 500;
const BG_DUR = 420; // fon kvadrati xiralikdan chiqishi

// Loading (shimmer) — assetdagi VaqtdaLoader: sikl 1.15s, barg orasida 72ms
const LOAD_CYCLE = 1150;
const LOAD_STAGGER = 72 / LOAD_CYCLE; // normallashtirilgan (0..1)

const BLOOM = Easing.bezierFn(0.2, 0.8, 0.25, 1);
const EASE = Easing.bezierFn(0.25, 0.1, 0.25, 1);

function Petal({
  index,
  t,
  color,
  variant,
}: {
  index: number;
  t: SharedValue<number>;
  color: string;
  variant: Variant;
}) {
  // Ichki G — markaz (50,50) atrofida masshtab/opacity/burilish animatsiyasi.
  const props = useAnimatedProps(() => {
    if (variant === "loading") {
      // Shimmer: opacity .22→1→.22, scale .82→1→.82, 35% da cho'qqi
      const phase = (((t.value - index * LOAD_STAGGER) % 1) + 1) % 1;
      const k =
        phase < 0.35
          ? phase / 0.35
          : Math.max(0, (1 - phase) / 0.65);
      return {
        opacity: 0.22 + 0.78 * k,
        scale: 0.82 + 0.18 * k,
        rotation: 0,
        originX: 50,
        originY: 50,
      };
    }
    // Intro bloom
    const ms = t.value * INTRO_TOTAL;
    const t0 = PETAL_DELAY + index * PETAL_STEP;
    const p = interpolate(ms, [t0, t0 + PETAL_DUR], [0, 1], Extrapolation.CLAMP);
    const e = BLOOM(p);
    return {
      opacity: interpolate(e, [0, 0.6], [0, 1], Extrapolation.CLAMP),
      scale: interpolate(e, [0, 0.6, 1], [0.15, 1.08, 1], Extrapolation.CLAMP),
      rotation: interpolate(e, [0, 0.6, 1], [-25, 4, 0], Extrapolation.CLAMP),
      originX: 50,
      originY: 50,
    };
  });

  return (
    <G rotation={ANGLES[index]} origin="50, 50">
      <AnimatedG animatedProps={props}>
        <Path d={PETAL} fill={color} />
      </AnimatedG>
    </G>
  );
}

export function AnimatedLogo({
  variant = "intro",
  size = 160,
  background = BRAND_GREEN,
  foreground = "#FFFFFF",
  onFinish,
}: {
  variant?: Variant;
  size?: number;
  /** null — yumaloq kvadrat fon chizilmaydi (masalan, tugma ichidagi kichik loader) */
  background?: string | null;
  foreground?: string;
  /** Faqat intro'da: animatsiya tugagach chaqiriladi */
  onFinish?: () => void;
}) {
  // Bitta umumiy taymlayn 0..1 — hamma bosqichlar shundan interpolate qilinadi
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    if (variant === "loading") {
      t.value = withRepeat(withTiming(1, { duration: LOAD_CYCLE, easing: Easing.linear }), -1);
    } else {
      t.value = withTiming(1, { duration: INTRO_TOTAL, easing: Easing.linear }, (done) => {
        if (done && onFinish) runOnJS(onFinish)();
      });
    }
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Fon kvadrati: intro'da .85→1 kattalashib xiralikdan chiqadi, loading'da statik
  const bgProps = useAnimatedProps(() => {
    if (variant !== "intro") return { opacity: 1, scale: 1, originX: 50, originY: 50 };
    const ms = t.value * INTRO_TOTAL;
    const e = BLOOM(interpolate(ms, [0, BG_DUR], [0, 1], Extrapolation.CLAMP));
    return { opacity: e, scale: 0.85 + 0.15 * e, originX: 50, originY: 50 };
  });

  // Galochka: intro'da chizilib chiqadi (loading'da umuman ko'rsatilmaydi)
  const tickProps = useAnimatedProps(() => {
    const ms = t.value * INTRO_TOTAL;
    const p = interpolate(ms, [TICK_START, TICK_START + TICK_DUR], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: TICK_LEN * (1 - EASE(p)) };
  });

  // Fon bo'lsa belgi 0.8 ga kichraytiriladi (app-icon.svg bilan bir xil "margin")
  const markScale = background ? 0.8 : 1;

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {background ? (
          <AnimatedRect
            animatedProps={bgProps}
            x={0}
            y={0}
            width={100}
            height={100}
            rx={22}
            fill={background}
          />
        ) : null}
        <G scale={markScale} origin="50, 50">
          {ANGLES.map((_, i) => (
            <Petal key={i} index={i} t={t} color={foreground} variant={variant} />
          ))}
          {variant === "intro" ? (
            <AnimatedPath
              animatedProps={tickProps}
              d={TICK}
              fill="none"
              stroke={foreground}
              strokeWidth={TICK_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[TICK_LEN, TICK_LEN]}
            />
          ) : null}
        </G>
      </Svg>
    </Animated.View>
  );
}
