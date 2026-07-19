// Vaqtda logo — yaproqli (marquise) belgi + galochka, yashil kvadrat fonda.
// Claude artifact "Vaqtda — logo animatsiyasi" dan birebir port (viewBox 0 0 200 200).
//
// Variantlar:
//   "intro"   — fon kvadrati kirib keladi, yaproqlar soat 12 dan boshlab har 110ms da
//               TO'LIQ OQ holicha paydo bo'ladi (bitta aylana); 1.0–1.26s da konturga
//               "bo'shashadi" (faqat chap-yuqori yaproq to'la qoladi — logotipning asl
//               holati), galochka chiziladi, butun logo bir puls qiladi (~1.98s),
//               tugagach onFinish chaqiriladi
//   "loading" — cheksiz aylanish (1.28s sikl): har 160ms da keyingi yaproq to'lib
//               "pop" qiladi va orqasidan so'nadi — brend loaderi
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

// Belgi geometriyasi (viewBox 0 0 200 200, markaz 100,100)
// Yaproq: ichki uchi (0,0) da, tepaga qaragan; markazdan 36px da joylashtiriladi
const LEAF = "M0 0 C 9 -7, 10 -24, 0 -34 C -10 -24, -9 -7, 0 0 Z";
const CHECK = "M74 100 L90 118 L122 80";
const CHECK_LEN = 75;
const CHECK_WIDTH = 7;
const LEAF_STROKE = 5;
// Soat yo'nalishida: 0=tepada (12), 315=chap-yuqori — logotipda to'la qoladigan yaproq
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const FILLED_INDEX = 7; // 315°

// Intro taymlayni (artifact: TOTAL=1980ms)
const INTRO_TOTAL = 1980;
const LEAF_STEP = 110; // yaproq i — i*110ms da paydo bo'ladi
const POP_UP = 230; // scale 0→1.12
const POP_SETTLE = 350; // →1
const REL_S = 1000; // "bo'shash": to'liq holatdan konturga qaytish
const REL_E = 1260;
const BG_DUR = 450; // fon: scale .85→1, xiralikdan chiqish
const CHECK_START = 1120;
const CHECK_DUR = 520;
const PULSE_START = 1480;
const PULSE_DUR = 500;
// Loading (artifact: 1280ms sikl, yaproqlar orasida 160ms)
const LOAD_CYCLE = 1280;
const LOAD_STAGGER = 160 / LOAD_CYCLE;
const LOAD_POP = 0.14; // siklning boshida scale 1.1→1

// Brend ranglari (artifact: --brand / --brand-deep)
export const BRAND_GREEN = "#0E8F6D";
export const BRAND_GREEN_DEEP = "#0B7458";

function Leaf({
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
  const stays = index === FILLED_INDEX;

  // Yaproq to'lishi (fill-opacity) — kontur (stroke) doim qoladi
  const fillProps = useAnimatedProps(() => {
    if (variant === "loading") {
      const phase = (((t.value - index * LOAD_STAGGER) % 1) + 1) % 1;
      return { fillOpacity: 1 - phase };
    }
    const ms = t.value * INTRO_TOTAL;
    const t0 = index * LEAF_STEP;
    let fill = interpolate(ms, [t0, t0 + 10], [0, 1], Extrapolation.CLAMP);
    if (!stays) fill *= 1 - interpolate(ms, [REL_S, REL_E], [0, 1], Extrapolation.CLAMP);
    return { fillOpacity: fill };
  });

  // Yaproq masshtabi — ichki uchi (markaz tomoni) atrofida
  const scaleProps = useAnimatedProps(() => {
    if (variant === "loading") {
      const phase = (((t.value - index * LOAD_STAGGER) % 1) + 1) % 1;
      return { scale: interpolate(phase, [0, LOAD_POP], [1.1, 1], Extrapolation.CLAMP) };
    }
    const ms = t.value * INTRO_TOTAL;
    const t0 = index * LEAF_STEP;
    return {
      scale: interpolate(
        ms,
        [t0, t0 + POP_UP, t0 + POP_SETTLE],
        [0.0001, 1.12, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <G rotation={ANGLES[index]} origin="100, 100">
      <G x={100} y={64}>
        <AnimatedG animatedProps={scaleProps}>
          <AnimatedPath
            animatedProps={fillProps}
            d={LEAF}
            fill={color}
            stroke={color}
            strokeWidth={LEAF_STROKE}
            strokeLinejoin="round"
          />
        </AnimatedG>
      </G>
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
  /** null — yashil kvadrat fon chizilmaydi (masalan, tugma ichidagi kichik loader) */
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
    if (variant !== "intro") return { opacity: 1, scale: 1 };
    const ms = t.value * INTRO_TOTAL;
    const e = Easing.bezierFn(0.22, 1, 0.36, 1)(
      interpolate(ms, [0, BG_DUR], [0, 1], Extrapolation.CLAMP)
    );
    return { opacity: e, scale: 0.85 + 0.15 * e };
  });

  // Galochka: intro'da 1120ms da chizilib chiqadi, loading'da doim ko'rinadi
  const checkProps = useAnimatedProps(() => {
    if (variant !== "intro") return { strokeDashoffset: 0 };
    const ms = t.value * INTRO_TOTAL;
    const p = interpolate(ms, [CHECK_START, CHECK_START + CHECK_DUR], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: CHECK_LEN * (1 - Easing.bezierFn(0.22, 1, 0.36, 1)(p)) };
  });

  // Puls: butun logo 4.5% kattalashib joyiga qaytadi — "tayyor" signali
  const pulseProps = useAnimatedProps(() => {
    if (variant !== "intro") return { scale: 1 };
    const ms = t.value * INTRO_TOTAL;
    const p = interpolate(ms, [PULSE_START, PULSE_START + PULSE_DUR], [0, 1], Extrapolation.CLAMP);
    const e = Easing.bezierFn(0.42, 0, 0.58, 1)(p);
    return { scale: interpolate(e, [0, 0.45, 1], [1, 1.045, 1], Extrapolation.CLAMP) };
  });

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {background ? (
          <AnimatedRect
            animatedProps={bgProps}
            x={0}
            y={0}
            width={200}
            height={200}
            rx={48}
            fill={background}
            origin="100, 100"
          />
        ) : null}
        <AnimatedG animatedProps={pulseProps} origin="100, 100">
          {ANGLES.map((_, i) => (
            <Leaf key={i} index={i} t={t} color={foreground} variant={variant} />
          ))}
          <AnimatedPath
            animatedProps={checkProps}
            d={CHECK}
            fill="none"
            stroke={foreground}
            strokeWidth={CHECK_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[CHECK_LEN, CHECK_LEN]}
          />
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}
