import React, { useEffect, useRef } from "react";
import { Animated, Easing, RefreshControl, StyleSheet, View } from "react-native";
import Svg, { Defs, G, Path, Rect, RadialGradient, Stop } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// intro.zip dizayni — "rozetka": markazdan 8 barg (petal) radial joylashadi,
// o'rtada tasdiq belgisi (tick). viewBox 0 0 100 100, aylanish markazi 50,50.
const PETAL = "M50 32.5 Q60.4 20.8 50 9.2 Q39.6 20.8 50 32.5 Z";
const TICK = "M42.68 50.39 L47.58 55.40 L57.33 43.83";
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Asosiy yashil (intro.zip: --green). Loader shu rangda ochiladi.
const BRAND = "#567157";

/**
 * VaqtdaLoading — hamma joyda ishlatiladigan loading indikatori.
 * intro.zip'dagi "shimmer" variant: 8 barg to'lqin bo'lib porlaydi
 * (opacity .22→1, scale .82→1), har biri 72ms kechikish bilan.
 *
 * Props:
 *   size?: number = 40
 *   color?: string = "#567157"   (to'q fonda "#fff" bering)
 *   bare?: boolean               (moslik uchun — endi ta'sir qilmaydi)
 */
export function VaqtdaLoading({
  size = 40,
  bare = false,
  color = BRAND,
}: {
  size?: number;
  bare?: boolean;
  color?: string;
}) {
  void bare;
  // Bitta native-driven aylanish (UI thread'da) — barglar statik, opacity
  // aylana bo'ylab pasayadi va "quyruqli" spinner ko'rinishi hosil bo'ladi.
  // Eski 8 ta JS-thread interpolatsiya olib tashlandi: ma'lumot yuklanayotganda
  // JS thread band bo'lsa ham animatsiya to'xtamaydi/jank bermaydi.
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {ANGLES.map((a, i) => (
          <G key={a} rotation={a} origin="50, 50">
            <Path d={PETAL} fill={color} opacity={0.16 + (i / (ANGLES.length - 1)) * 0.84} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

/**
 * Pull-to-refresh: native spinner butunlay shaffof qilinadi (ikki platformada
 * ham ko'rinmaydi), o'rniga bizning brend indikatorimiz — VaqtdaRefreshing —
 * ekranda chiqadi. Shu tarzda "o'zimizniki" (Vaqtda barglari) ko'rinadi.
 */
export function VaqtdaRefreshControl(props: React.ComponentProps<typeof RefreshControl>) {
  return (
    <RefreshControl
      {...props}
      tintColor="transparent"
      colors={["transparent"]}
      progressBackgroundColor="transparent"
      style={{ backgroundColor: "transparent" }}
    />
  );
}

/**
 * Refresh paytida kontent tepasida chiqadigan brend indikator.
 * Fon shaffof native spinner o'rniga — Vaqtda barglari, yumshoq kirish
 * animatsiyasi (fade + scale) bilan.
 */
export function VaqtdaRefreshing({ refreshing }: { refreshing: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: refreshing ? 1 : 0,
      duration: refreshing ? 260 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [refreshing, anim]);

  // Ko'rinmayotgan bo'lsa (animatsiya ham tugagan) — DOM'dan olib tashlaymiz.
  if (!refreshing) return null;

  return (
    <Animated.View
      style={{
        alignItems: "center",
        paddingVertical: 10,
        opacity: anim,
        transform: [
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
        ],
      }}
    >
      <VaqtdaLoading size={34} />
    </Animated.View>
  );
}

/**
 * VaqtdaIntro — ilova kirishidagi splash (intro.zip: VaqtdaSplash).
 * Yashil radial gradient fon → oq barglar ketma-ket "ochiladi" (bloom) →
 * tasdiq belgisi chiziladi → "Vaqtda" nomi paydo bo'ladi → sahna xiralashib
 * yo'qoladi. Jami ~2.4s.
 *
 * Props:
 *   onDone: () => void            animatsiya tugagach chaqiriladi
 *   backgroundColor?: string      (moslik uchun — splash doim yashil gradient)
 */
export function VaqtdaIntro({
  onDone,
  backgroundColor,
}: {
  onDone: () => void;
  backgroundColor?: string;
}) {
  void backgroundColor;

  const blooms = useRef(ANGLES.map(() => new Animated.Value(0))).current;
  const tick = useRef(new Animated.Value(0)).current; // 0 → 1 (belgi chiziladi)
  const word = useRef(new Animated.Value(0)).current; // 0 → 1 (nom paydo bo'ladi)
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const sceneScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const bloom = Easing.bezier(0.2, 0.8, 0.25, 1);

    // Har bir barg: 50 + i*60 ms kechikib, 550ms da ochiladi.
    const petalAnims = blooms.map((b, i) =>
      Animated.sequence([
        Animated.delay(50 + i * 60),
        Animated.timing(b, { toValue: 1, duration: 550, easing: bloom, useNativeDriver: false }),
      ])
    );
    // Belgi: 950ms da 500ms davomida chiziladi.
    const tickAnim = Animated.sequence([
      Animated.delay(950),
      Animated.timing(tick, { toValue: 1, duration: 500, easing: Easing.ease, useNativeDriver: false }),
    ]);
    // Nom: 1200ms da 500ms davomida ko'tarilib paydo bo'ladi.
    const wordAnim = Animated.sequence([
      Animated.delay(1200),
      Animated.timing(word, { toValue: 1, duration: 500, easing: Easing.ease, useNativeDriver: false }),
    ]);

    Animated.parallel([...petalAnims, tickAnim, wordAnim]).start();

    // ~2.15s da sahna xiralashib, biroz kattalashib yo'qoladi.
    const exit = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sceneOpacity, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.timing(sceneScale, { toValue: 1.06, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]).start(() => onDone());
    }, 2150);

    return () => clearTimeout(exit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickOffset = tick.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const wordTranslate = word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: sceneOpacity, zIndex: 999 }]}>
      {/* Yashil radial gradient fon (intro.zip: 6e8d6e → 567157 → 46603f) */}
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <RadialGradient id="vqIntroBg" cx="50%" cy="34%" r="90%">
            <Stop offset="0%" stopColor="#6e8d6e" />
            <Stop offset="52%" stopColor="#567157" />
            <Stop offset="100%" stopColor="#46603f" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vqIntroBg)" />
      </Svg>

      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: sceneScale }],
        }}
      >
        <Svg width={112} height={112} viewBox="0 0 100 100">
          {ANGLES.map((a, i) => (
            <G key={a} rotation={a} origin="50, 50">
              <AnimatedG
                origin="50, 50"
                scale={blooms[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.15, 1.08, 1] })}
                rotation={blooms[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [-25, 4, 0] })}
              >
                <AnimatedPath
                  d={PETAL}
                  fill="#fff"
                  opacity={blooms[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] })}
                />
              </AnimatedG>
            </G>
          ))}
          <AnimatedPath
            d={TICK}
            fill="none"
            stroke="#fff"
            strokeWidth={4.63}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[24, 24]}
            strokeDashoffset={tickOffset}
          />
        </Svg>

        <Animated.Text
          style={{
            color: "#fff",
            fontSize: 30,
            fontWeight: "700",
            letterSpacing: -0.5,
            marginTop: 18,
            opacity: word,
            transform: [{ translateY: wordTranslate }],
          }}
        >
          Vaqtda
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}
