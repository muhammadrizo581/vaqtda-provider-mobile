// Vaqtda logo — 8 barg (gul/quyosh) markazdan taraladi + o'rtada galochka.
// Mijoz ilovasi (vaqtda-mobile) bilan bir xil animatsiya dvigateli: oddiy
// RN Animated (reanimated'siz) — JS thread band bo'lsa ham bir xil ishlaydi.
//
// Variantlar:
//   "intro"   — barglar markazdan ketma-ket "gullab" ochiladi, so'ng galochka
//               chiziladi (~1.5s, onFinish). background bo'lsa yumaloq kvadrat
//               ham xiralikdan chiqadi.
//   "loading" — mijoz ilovasidagi VaqtdaLoading'ga delegatsiya: aylanuvchi
//               barglar spinneri (galochkasiz, fon kvadratisiz).
import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { VaqtdaLoading } from "@/components/vaqtda-logo";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Variant = "intro" | "loading";

// Belgi geometriyasi (viewBox 0 0 100 100, markaz 50,50) — mijoz ilovasi bilan bir xil
const PETAL = "M50 32.5 Q60.4 20.8 50 9.2 Q39.6 20.8 50 32.5 Z";
const TICK = "M42.68 50.39 L47.58 55.40 L57.33 43.83";
const TICK_LEN = 24;
const TICK_WIDTH = 4.63;
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Brend ranglari (assets/brand — #567157 sage yashil)
export const BRAND_GREEN = "#567157";
export const BRAND_GREEN_DEEP = "#46603f";

// Intro taymlayni (ms) — mijoz ilovasidagi VaqtdaIntro bilan bir xil
const INTRO_TOTAL = 1500;
const PETAL_DELAY = 50;
const PETAL_STEP = 60;
const PETAL_DUR = 550;
const TICK_START = 950;
const TICK_DUR = 500;
const BG_DUR = 420;

function IntroLogo({
  size,
  background,
  foreground,
  onFinish,
}: {
  size: number;
  background: string | null;
  foreground: string;
  onFinish?: () => void;
}) {
  const blooms = useRef(ANGLES.map(() => new Animated.Value(0))).current;
  const tick = useRef(new Animated.Value(0)).current;
  const bg = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bloom = Easing.bezier(0.2, 0.8, 0.25, 1);
    Animated.parallel([
      ...blooms.map((b, i) =>
        Animated.sequence([
          Animated.delay(PETAL_DELAY + i * PETAL_STEP),
          Animated.timing(b, { toValue: 1, duration: PETAL_DUR, easing: bloom, useNativeDriver: false }),
        ])
      ),
      Animated.sequence([
        Animated.delay(TICK_START),
        Animated.timing(tick, { toValue: 1, duration: TICK_DUR, easing: Easing.ease, useNativeDriver: false }),
      ]),
      Animated.timing(bg, { toValue: 1, duration: BG_DUR, easing: bloom, useNativeDriver: false }),
    ]).start();

    const done = setTimeout(() => onFinish?.(), INTRO_TOTAL);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fon bo'lsa belgi 0.8 ga kichraytiriladi (app-icon.svg bilan bir xil "margin")
  const markScale = background ? 0.8 : 1;

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {background ? (
          <AnimatedRect
            x={0}
            y={0}
            width={100}
            height={100}
            rx={22}
            fill={background}
            origin="50, 50"
            opacity={bg}
            scale={bg.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })}
          />
        ) : null}
        <G scale={markScale} origin="50, 50">
          {ANGLES.map((a, i) => (
            <G key={a} rotation={a} origin="50, 50">
              <AnimatedG
                origin="50, 50"
                scale={blooms[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.15, 1.08, 1] })}
                rotation={blooms[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [-25, 4, 0] })}
              >
                <AnimatedPath
                  d={PETAL}
                  fill={foreground}
                  opacity={blooms[i].interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0, 1, 1],
                  })}
                />
              </AnimatedG>
            </G>
          ))}
          <AnimatedPath
            d={TICK}
            fill="none"
            stroke={foreground}
            strokeWidth={TICK_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[TICK_LEN, TICK_LEN]}
            strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [TICK_LEN, 0] })}
          />
        </G>
      </Svg>
    </Animated.View>
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
  /** null — fon kvadrati yo'q (masalan, tugma ichidagi kichik loader) */
  background?: string | null;
  foreground?: string;
  /** Faqat intro'da: animatsiya tugagach chaqiriladi */
  onFinish?: () => void;
}) {
  if (variant === "loading") {
    // Mijoz ilovasidagi spinner: fon kvadratisiz brend-yashil barglar;
    // fon berilmagan (null) joylarda — chaqiruvchi bergan rang (tugma ichi va h.k.)
    return <VaqtdaLoading size={size} color={background ? BRAND_GREEN : foreground} />;
  }
  return <IntroLogo size={size} background={background} foreground={foreground} onFinish={onFinish} />;
}
